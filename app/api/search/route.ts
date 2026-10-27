import { NextRequest } from "next/server";
import { listClips, publicClip } from "@/lib/store";
import { samples } from "@/lib/samples";
import { rankClips } from "@/lib/search";
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
        : [...samples, ...all.filter((c) => c.source !== "twitch")];
    let vector: number[] | undefined;
    let notice =
      "Sample clips use authored demonstration evidence and keyword matching.";
    if (
      aiConfigured() &&
      clips.some((c) => c.embeddingModel === embeddingModel())
    ) {
      try {
        [vector] = await embed([query]);
        notice = "Hybrid search across saved transcript and visual indexes.";
      } catch {
        notice =
          "Semantic search is temporarily unavailable. Showing keyword matches.";
      }
    }
    return Response.json({
      results: rankClips(clips, query, vector, embeddingModel()).map((m) => ({
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
