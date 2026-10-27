import { NextRequest } from "next/server";
import { session, helix } from "@/lib/twitch";
import { checkOrigin, failure } from "@/lib/http";
import { listClips, saveClip, publicClip, dataDir } from "@/lib/store";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { aiConfigured } from "@/lib/ai";
import { kickWorker } from "@/lib/pipeline";
export async function GET(req: NextRequest) {
  try {
    const s = session(req);
    if (!s) return failure(new Error("Connect with Twitch first."), 401);
    const broadcaster = req.nextUrl.searchParams.get("broadcaster") || s.userId;
    if (!/^\d+$/.test(broadcaster))
      throw new Error("Enter a numeric broadcaster ID.");
    const p = new URLSearchParams({ broadcaster_id: broadcaster, first: "12" });
    const cursor = req.nextUrl.searchParams.get("after");
    if (cursor) p.set("after", cursor);
    const result = await helix(s, `clips?${p}`);
    return Response.json(result);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const s = session(req);
    if (!s) return failure(new Error("Connect with Twitch first."), 401);
    const { id } = await req.json();
    if (typeof id !== "string" || !/^[\w-]{1,200}$/.test(id))
      throw new Error("Invalid clip ID.");
    const existing = (await listClips()).find(
      (c) => c.twitchId === id && c.owner === s.userId,
    );
    if (existing) return Response.json(publicClip(existing));
    const result = await helix(s, `clips?id=${encodeURIComponent(id)}`);
    const c = result.data[0];
    if (!c) throw new Error("This clip has been deleted or is unavailable.");
    const p = new URLSearchParams({
      clip_id: id,
      broadcaster_id: c.broadcaster_id,
      editor_id: s.userId,
    });
    const download = await helix(s, `clips/downloads?${p}`);
    const link =
      download.data?.[0]?.landscape_download_url ||
      download.data?.[0]?.portrait_download_url;
    if (!link)
      throw new Error("Twitch has no downloadable video for this clip.");
    const target = new URL(link);
    if (
      target.protocol !== "https:" ||
      !target.hostname.endsWith(".twitchcdn.net")
    )
      throw new Error("Unexpected Twitch media host.");
    const response = await fetch(target, {
      signal: AbortSignal.timeout(60000),
      redirect: "error",
    });
    if (!response.ok || !response.body)
      throw new Error(
        "Twitch download expired or is unavailable. Please retry.",
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 100 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Clip exceeds the 100 MB demo limit.");
      }
      chunks.push(value);
    }
    const localId = randomUUID();
    await mkdir(path.join(dataDir, "uploads"), { recursive: true });
    const file = path.join(dataDir, "uploads", localId + ".mp4");
    await writeFile(file, Buffer.concat(chunks));
    let category: string | undefined;
    if (c.game_id) {
      try {
        category = (await helix(s, `games?id=${encodeURIComponent(c.game_id)}`))
          .data[0]?.name;
      } catch {
        /* Metadata is optional. */
      }
    }
    const clip = {
      id: localId,
      title: c.title,
      streamer: c.broadcaster_name,
      category,
      date: c.created_at,
      twitchUrl: c.url,
      twitchId: c.id,
      broadcasterId: c.broadcaster_id,
      owner: s.userId,
      source: "twitch" as const,
      status: aiConfigured() ? ("queued" as const) : ("needs_config" as const),
      segments: [],
      file,
      duration: c.duration,
      createdAt: new Date().toISOString(),
    };
    await saveClip(clip);
    kickWorker();
    return Response.json(publicClip(clip));
  } catch (e) {
    return failure(e);
  }
}
