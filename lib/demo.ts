import { Clip } from "./types";
import { rankClips } from "./search";

/**
 * Hosted demos set CLIPDEXER_READ_ONLY=1 so visitors can search and play the
 * preloaded collection without uploading, re-indexing, or deleting clips.
 */
export const readOnly = () =>
  ["1", "true", "yes"].includes(
    (process.env.CLIPDEXER_READ_ONLY || "").toLowerCase(),
  );

export const READ_ONLY_MESSAGE =
  "This hosted demo is read-only. Run Clipdexer locally to add and index your own clips.";

export function assertWritable() {
  if (readOnly()) throw new Error(READ_ONLY_MESSAGE);
}

/** Phrased the way people describe half-remembered clips. */
const CANDIDATES = [
  "wearing a red jersey and says my heart dropped",
  "talking about earrings",
  "a volleyball game",
  "talking about the Chick-fil-A sandwich",
  "pause menu",
  "pickaxe in a cave",
  "Fortnite",
  "holding a cup",
  "wearing a purple shirt",
  "talking about a cat",
];

/**
 * Example queries shown under the search box. Only examples that produce a
 * strong keyword match in the current collection are offered, so a click
 * always shows real evidence and never costs an embedding request.
 */
export function exampleQueries(clips: Clip[], limit = 4) {
  const ready = clips.filter((c) => c.status === "ready");
  if (!ready.length) return [];
  const extra = (process.env.CLIPDEXER_EXAMPLES || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const examples: string[] = [];
  for (const query of [...extra, ...CANDIDATES]) {
    if (examples.length >= limit) break;
    const best = rankClips(ready, query)[0];
    if (!best || best.confidence !== "strong" || seen.has(best.clip.id))
      continue;
    seen.add(best.clip.id);
    examples.push(query);
  }
  return examples;
}
