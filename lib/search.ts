import { Clip, Match, Segment } from "./types";
const stop = new Set(
  "find the clip where is a an and or of to me that with in on at was it he she they someone person show when i remember wearing talking about video moment please but".split(
    " ",
  ),
);
const related: Record<string, string> = {
  exhausted: "tired",
  sleepy: "tired",
  furious: "angry",
  enraged: "angry",
  laughing: "laugh",
  laughs: "laugh",
  laughed: "laugh",
  laughter: "laugh",
  chuckling: "laugh",
  gaming: "game",
  games: "game",
  gameplay: "game",
  playing: "play",
  plays: "play",
  falls: "fall",
  falling: "fall",
  fell: "fall",
  shirts: "shirt",
  tshirt: "shirt",
};
function normalize(text: string) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(" ");
}
export function tokens(text: string) {
  return [
    ...new Set(
      normalize(text.replace(/t-shirt/gi, "tshirt"))
        .split(" ")
        .filter((w) => w && !stop.has(w))
        .map((w) => related[w] || w),
    ),
  ];
}
function containsPhrase(text: string, phrase: string) {
  return ` ${normalize(text)} `.includes(` ${normalize(phrase)} `);
}
export type SearchClue = {
  text: string;
  kind?: Segment["kind"];
  phrases: string[];
};
export type SearchQuery = { clues: SearchClue[]; exclusions: SearchClue[] };
const visual =
  /\b(shirt|hoodie|jacket|hat|dress|trousers|pants|clothing|wearing|visible|holding|purple|red|blue|green|yellow|orange|black|white)\b/i;
const markers =
  /\b(talking about|speaking about|talks about|speaks about|saying|says|said|mentions?|discussing|discusses|wearing|wears|dressed in|holding|holds|visible|showing)\b/gi;
const speechMarker = /^(talk|speak|say|said|mention|discuss)/;

/** Protect quotes before interpreting intent words or exclusions inside them. */
export function parseQuery(query: string): SearchQuery {
  const quoted: string[] = [];
  let text = query.replace(/["“]([^"”]+)["”]/g, (_, phrase: string) => {
    quoted.push(phrase);
    return `zzquote${quoted.length - 1}zz`;
  });
  function clue(raw: string, kind?: Segment["kind"]): SearchClue {
    const phrases: string[] = [];
    const restored = raw
      .replace(/zzquote(\d+)zz/g, (_, n) => {
        phrases.push(quoted[Number(n)]);
        return quoted[Number(n)];
      })
      .trim();
    return { text: restored, kind, phrases };
  }
  const exclusions: SearchClue[] = [];
  text = text.replace(
    /\b(?:not|without|exclude|excluding|except)\s+(.+?)(?=\s+(?:and|but)\s+|[,;]|$)/gi,
    (_, raw: string) => {
      const marker = raw.match(
        /^\s*(?:the\s+)?(talking about|saying|wearing|holding)\s+/i,
      );
      exclusions.push(
        clue(
          raw
            .replace(/^\s*the\s+/i, "")
            .replace(/^(talking about|saying|wearing|holding)\s+/i, ""),
          marker
            ? speechMarker.test(marker[1].toLowerCase())
              ? "speech"
              : "visual"
            : undefined,
        ),
      );
      return " ";
    },
  );
  const clues: SearchClue[] = [];
  const matches = [...text.matchAll(markers)];
  function add(raw: string, kind?: Segment["kind"]) {
    const item = clue(
      raw
        .replace(/^[\s,;]+|[\s,;]+$/g, "")
        .replace(/\b(?:and|or|but)\s*$/i, "")
        .trim(),
      kind,
    );
    if (tokens(item.text).length || item.phrases.length) clues.push(item);
  }
  const prefix = text.slice(0, matches[0]?.index ?? text.length);
  add(prefix, visual.test(prefix) ? "visual" : undefined);
  matches.forEach((match, i) => {
    const kind = speechMarker.test(match[0].toLowerCase())
      ? "speech"
      : "visual";
    add(
      text.slice(
        match.index! + match[0].length,
        matches[i + 1]?.index ?? text.length,
      ),
      kind,
    );
  });
  return { clues, exclusions };
}
/**
 * Cosine thresholds calibrated for OpenAI text-embedding-3 models, where a
 * relevant query/description pair typically scores 0.43-0.55 and unrelated
 * text stays around 0.20-0.35.
 */
export const SEMANTIC_CANDIDATE = 0.4;
export const SEMANTIC_SUPPORT = 0.45;
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0,
    aa = 0,
    bb = 0;
  a.forEach((n, i) => {
    dot += n * b[i];
    aa += n * n;
    bb += b[i] * b[i];
  });
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
function excluded(clip: Clip, clues: SearchClue[]) {
  return clues.some((clue) => {
    const texts = clip.segments
      .filter((s) => !clue.kind || s.kind === clue.kind)
      .map((s) => s.text);
    if (!clue.kind) texts.push(clip.category || "", clip.title);
    const words = tokens(clue.text);
    return texts.some((text) =>
      words.length > 0
        ? words.every((w) => tokens(text).includes(w))
        : clue.phrases.length > 0 &&
          clue.phrases.every((p) => containsPhrase(text, p)),
    );
  });
}
export function rankClips(
  clips: Clip[],
  query: string,
  vector?: number[],
  model?: string,
  clueVectors?: number[][],
): Match[] {
  const parsed = parseQuery(query);
  if (!parsed.clues.length) return [];
  return clips
    .filter((c) => c.status === "ready" && !excluded(c, parsed.exclusions))
    .flatMap((clip) => {
      const candidates = clip.segments
        .map((anchor) => {
          const window = clip.segments.filter(
            (s) => s.start >= anchor.start && s.start <= anchor.start + 12,
          );
          const scored = parsed.clues.map((clue, i) => {
            const words = tokens(clue.text);
            const queryVector =
              clueVectors?.[i] ||
              (parsed.clues.length === 1 ? vector : undefined);
            return window
              .filter((s) => !clue.kind || s.kind === clue.kind)
              .map((segment) => {
                const terms = tokens(segment.text);
                const phraseMatch =
                  clue.phrases.length > 0 &&
                  clue.phrases.every((p) => containsPhrase(segment.text, p));
                const coverage = words.length
                  ? words.filter((w) => terms.includes(w)).length / words.length
                  : phraseMatch
                    ? 1
                    : 0;
                const semantic =
                  queryVector &&
                  clip.embeddingModel === model &&
                  segment.embedding
                    ? Math.max(0, cosine(queryVector, segment.embedding))
                    : 0;
                return {
                  segment,
                  coverage,
                  semantic,
                  score:
                    coverage * 0.7 + semantic * 0.3 + (phraseMatch ? 0.05 : 0),
                };
              })
              .filter((s) => s.coverage > 0 || s.semantic >= SEMANTIC_CANDIDATE)
              .sort((a, b) => b.score - a.score)[0];
          });
          const supported = scored.filter(
            (s) => s && (s.coverage >= 0.7 || s.semantic >= SEMANTIC_SUPPORT),
          ).length;
          const strong = scored.every((s) => s && s.coverage >= 0.7);
          const evidence = [
            ...new Set(scored.flatMap((s) => (s ? [s.segment] : []))),
          ];
          const score =
            scored.reduce((sum, s) => sum + (s?.score || 0), 0) /
              parsed.clues.length +
            (0.15 * supported) / parsed.clues.length;
          if (!evidence.length || score < 0.12) return null;
          const missing = parsed.clues.filter(
            (_, i) =>
              !scored[i] ||
              (scored[i].coverage < 0.7 &&
                scored[i].semantic < SEMANTIC_SUPPORT),
          );
          const explanation = missing.length
            ? `Partial match. Not confirmed: ${missing.map((c) => `${c.kind || "content"}: ${c.text}`).join("; ")}.`
            : strong
              ? "Your clues are supported by saved evidence within the same 12-second window."
              : "Related wording found in saved evidence. Review the moment to confirm the match.";
          return {
            clip,
            score,
            confidence: strong ? "strong" : "weak",
            timestamp: evidence[0].start,
            evidence,
            explanation,
            partial: missing.length > 0,
          } as Match;
        })
        .filter((m): m is Match => m !== null)
        .sort((a, b) => b.score - a.score);
      if (candidates[0]) return [candidates[0]];
      // People often remember a clip by its title or streamer. Offer it as a
      // low-ranked, clearly labeled fallback without inventing evidence.
      const label = tokens(`${clip.title} ${clip.streamer || ""}`);
      const words = [...new Set(parsed.clues.flatMap((c) => tokens(c.text)))];
      if (!words.length || !words.every((w) => label.includes(w))) return [];
      return [
        {
          clip,
          score: 0.1,
          confidence: "weak",
          timestamp: 0,
          evidence: [],
          explanation:
            "Matched the clip title or streamer, not the saved footage index.",
          partial: true,
        } as Match,
      ];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}
