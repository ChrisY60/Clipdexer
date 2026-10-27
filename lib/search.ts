import { Clip, Match } from "./types";
const stop = new Set(
  "find the clip where is a an and or of to me that wearing talking about with in on at was it he she they someone person show when i remember".split(
    " ",
  ),
);
export function tokens(text: string) {
  return [
    ...new Set(
      (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
        (w) => !stop.has(w),
      ),
    ),
  ];
}
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
export function rankClips(
  clips: Clip[],
  query: string,
  vector?: number[],
  model?: string,
): Match[] {
  const words = tokens(query);
  const normalize = (s: string) =>
    (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(" ");
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((m) => normalize(m[1]));
  const pairs = words.slice(1).map((word, i) => `${words[i]} ${word}`);
  if (!words.length) return [];
  return clips
    .filter((c) => c.status === "ready")
    .map((clip) => {
      const scored = clip.segments
        .map((segment) => {
          const text = segment.text.toLowerCase();
          const terms = tokens(text);
          const hits = words.filter((w) => terms.includes(w));
          const normalized = normalize(text);
          const phraseScore = pairs.length
            ? pairs.filter((p) => normalized.includes(p)).length / pairs.length
            : 0;
          const semantic =
            vector && clip.embeddingModel === model && segment.embedding
              ? cosine(vector, segment.embedding)
              : 0;
          return {
            segment,
            hits,
            score:
              (hits.length / words.length) * 0.6 +
              Math.max(0, semantic) * 0.3 +
              phraseScore * 0.1,
            phraseScore,
            semantic,
          };
        })
        .sort((a, b) => b.score - a.score);
      const found = new Set(scored.flatMap((s) => s.hits));
      const coverage = found.size / words.length;
      const semantic = scored[0]?.semantic || 0;
      const evidence = scored
        .filter((s) => s.hits.length || s.semantic >= 0.48)
        .slice(0, 3)
        .map((s) => s.segment);
      const phrasesMatch = phrases.every((p) =>
        clip.segments.some((s) => normalize(s.text).includes(p)),
      );
      const strong = coverage >= 0.7 && found.size > 0 && phrasesMatch;
      const score =
        coverage * 0.6 + semantic * 0.3 + (scored[0]?.phraseScore || 0) * 0.1;
      return {
        clip,
        score,
        confidence: strong ? "strong" : "weak",
        timestamp: evidence[0]?.start || 0,
        evidence,
      } as Match;
    })
    .filter((m) => m.evidence.length && m.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}
