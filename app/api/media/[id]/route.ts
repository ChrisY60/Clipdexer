import { NextRequest } from "next/server";
import { stat, open } from "node:fs/promises";
import path from "node:path";
import { listClips, dataDir } from "@/lib/store";
import { session } from "@/lib/twitch";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clip = (await listClips()).find((c) => c.id === id);
  if (
    !clip?.file ||
    (clip.source === "twitch" && clip.owner !== session(req)?.userId)
  )
    return new Response("Not found", { status: 404 });
  let file = path.join(dataDir, "media", id, "preview.mp4");
  try {
    await stat(/* turbopackIgnore: true */ file);
  } catch {
    file = clip.file;
  }
  let size: number;
  try {
    size = (await stat(/* turbopackIgnore: true */ file)).size;
  } catch {
    return new Response("The local video file is unavailable.", {
      status: 404,
    });
  }
  const range = req.headers.get("range");
  let start = 0,
    end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    }
    if (start > end || start >= size)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
  }
  const handle = await open(/* turbopackIgnore: true */ file, "r");
  let position = start;
  const stream = new ReadableStream({
    async pull(controller) {
      const remaining = end - position + 1;
      if (remaining <= 0) {
        await handle.close();
        controller.close();
        return;
      }
      const buffer = Buffer.alloc(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position,
      );
      if (!bytesRead) {
        await handle.close();
        controller.close();
        return;
      }
      position += bytesRead;
      controller.enqueue(buffer.subarray(0, bytesRead));
    },
    async cancel() {
      await handle.close();
    },
  });
  return new Response(stream, {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": file.endsWith(".webm")
        ? "video/webm"
        : file.endsWith(".mov")
          ? "video/quicktime"
          : "video/mp4",
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
