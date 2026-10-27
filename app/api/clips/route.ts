import { NextRequest } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  listClips,
  saveClip,
  publicClip,
  dataDir,
  patchClip,
} from "@/lib/store";
import { samples } from "@/lib/samples";
import { session } from "@/lib/twitch";
import { aiConfigured } from "@/lib/ai";
import { kickWorker, probe } from "@/lib/pipeline";
import { checkOrigin, failure, twitchUrl } from "@/lib/http";
import { Clip } from "@/lib/types";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  kickWorker();
  const s = session(req);
  const mode = req.nextUrl.searchParams.get("mode");
  const clips = await listClips();
  return Response.json(
    (mode === "twitch"
      ? clips.filter((c) => c.source === "twitch" && c.owner === s?.userId && s)
      : [...samples, ...clips.filter((c) => c.source !== "twitch")]
    ).map(publicClip),
  );
}
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    if (Number(req.headers.get("content-length")) > 100 * 1024 * 1024)
      throw new Error("Maximum upload size is 100 MB.");
    const form = await req.formData();
    const file = form.get("file");
    const url = String(form.get("url") || "").trim();
    const title = String(form.get("title") || "").slice(0, 160);
    const id = randomUUID();
    const clip: Clip = {
      id,
      title: title || "Untitled clip",
      source: "link",
      status: "link",
      segments: [],
      createdAt: new Date().toISOString(),
      ...(url ? { twitchUrl: twitchUrl(url) } : {}),
      streamer: String(form.get("streamer") || "").slice(0, 80) || undefined,
    };
    if (file instanceof File && file.size) {
      if (file.size > 100 * 1024 * 1024)
        throw new Error("Maximum upload size is 100 MB.");
      if (!/\.(mp4|webm|mov|mkv)$/i.test(file.name))
        throw new Error("Use MP4, WebM, MOV or MKV.");
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = createHash("sha256").update(buffer).digest("hex");
      const previous = (await listClips()).find(
        (c) => c.hash === hash && c.source === "upload",
      );
      if (previous) return Response.json(publicClip(previous));
      await mkdir(path.join(dataDir, "uploads"), { recursive: true });
      const filePath = path.join(
        dataDir,
        "uploads",
        id + path.extname(file.name).toLowerCase(),
      );
      await writeFile(filePath, buffer);
      let info;
      try {
        info = await probe(filePath);
      } catch (e) {
        await unlink(filePath);
        throw e;
      }
      Object.assign(clip, {
        file: filePath,
        hash,
        duration: info.duration,
        title: title || file.name.replace(/\.[^.]+$/, ""),
        source: "upload",
        status: aiConfigured() ? "queued" : "needs_config",
        stage: aiConfigured() ? "Waiting to index" : "AI credentials required",
      });
    } else if (!url)
      throw new Error("Choose a video or enter a Twitch clip URL.");
    await saveClip(clip);
    kickWorker();
    return Response.json(publicClip(clip), { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: NextRequest) {
  try {
    checkOrigin(req);
    const { id } = await req.json();
    const clip = (await listClips()).find((c) => c.id === id);
    if (
      !clip ||
      (clip.source === "twitch" && clip.owner !== session(req)?.userId)
    )
      return failure(new Error("Clip not found"), 404);
    if (!clip.file) throw new Error("A video file is required for indexing.");
    if (!aiConfigured())
      throw new Error("Set OPENAI_API_KEY in .env.local and restart the app.");
    if (!["error", "needs_config"].includes(clip.status))
      throw new Error("This clip is already indexed or processing.");
    await patchClip(id, { status: "queued", error: undefined });
    kickWorker();
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
