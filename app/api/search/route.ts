import { NextRequest } from "next/server";
import { listClips, publicClip } from "@/lib/store";
import { rankClips, parseQuery } from "@/lib/search";
import { aiConfigured, embed, embeddingModel } from "@/lib/ai";
import { session } from "@/lib/twitch";
import { checkOrigin, failure } from "@/lib/http";
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const { query, mode } = await req.json();
    if (typeof query !== "string" || !query.trim() || query.length > 500)
      throw new Error("Enter a search of 1–500 characters.");
    const s = session(req);
    const all = await listClips();
    const clips =
      mode === "twitch"
        ? all.filter((c) => s && c.owner === s.userId && c.source === "twitch")
        : all.filter((c) => c.source !== "twitch");
    let clueVectors: number[][] | undefined;
    const parsed = parseQuery(query);
    let notice = "Search across your saved speech and visual evidence.";
    if (
      parsed.clues.length > 0 &&
      aiConfigured() &&
      clips.some((c) => c.embeddingModel === embeddingModel())
    ) {
      try {
        clueVectors = await embed(parsed.clues.map((clue) => clue.text));
        notice = "Hybrid search across saved transcript and visual indexes.";
      } catch {
        notice =
          "Semantic search is temporarily unavailable. Showing keyword matches.";
      }
    }
    return Response.json({
      results: rankClips(
        clips,
        query,
        undefined,
        embeddingModel(),
        clueVectors,
      ).map((m) => ({
        ...m,
        clip: publicClip(m.clip),
        evidence: m.evidence.map(({ embedding, ...rest }) => {
          void embedding;
          return rest;
        }),
      })),
      notice,
    });
  } catch (e) {
    return failure(e);
  }
}
