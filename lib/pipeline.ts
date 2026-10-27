import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, stat, rename } from "node:fs/promises";
import path from "node:path";
import {
  aiConfigured,
  transcribe,
  describeFrame,
  embed,
  embeddingModel,
} from "./ai";
import { dataDir, listClips, patchClip } from "./store";
const exec = promisify(execFile);
const state = globalThis as typeof globalThis & { clipWorker?: Promise<void> };
export async function probe(file: string) {
  const { stdout } = await exec(
    process.env.FFPROBE_PATH || "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type",
      "-of",
      "json",
      file,
    ],
    { timeout: 30000 },
  );
  const value = JSON.parse(stdout);
  const duration = Number(value.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 180)
    throw new Error("Upload a video between 1 and 180 seconds long.");
  if (
    !value.streams?.some(
      (s: { codec_type: string }) => s.codec_type === "video",
    )
  )
    throw new Error("The file does not contain a video stream.");
  return {
    duration,
    audio: value.streams.some(
      (s: { codec_type: string }) => s.codec_type === "audio",
    ),
  };
}
async function ff(args: string[]) {
  await exec(
    process.env.FFMPEG_PATH || "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { timeout: 180000, maxBuffer: 1024 * 1024 },
  );
}
async function processClip(id: string) {
  const clip = (await listClips()).find((c) => c.id === id);
  if (!clip?.file) return;
  if (!aiConfigured()) {
    await patchClip(id, {
      status: "needs_config",
      stage: "Add OPENAI_API_KEY to index this video.",
    });
    return;
  }
  try {
    await patchClip(id, {
      status: "processing",
      stage: "Inspecting video",
      error: undefined,
    });
    const info = await probe(clip.file);
    const dir = path.join(dataDir, "media", id);
    await mkdir(dir, { recursive: true });
    await patchClip(id, { duration: info.duration });
    const preview = path.join(dir, "preview.mp4");
    const temporaryPreview = path.join(dir, "preview-working.mp4");
    let previewExists = false;
    try {
      await stat(preview);
      previewExists = true;
    } catch {
      /* First attempt. */
    }
    if (!previewExists) {
      await ff([
        "-i",
        clip.file,
        "-t",
        "180",
        "-vf",
        "scale=960:-2",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "25",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        temporaryPreview,
      ]);
      await rename(temporaryPreview, preview);
    }
    let segments = clip.segments.filter((s) => s.kind === "speech");
    if (info.audio && !segments.length) {
      await patchClip(id, { stage: "Transcribing speech" });
      const audio = path.join(dir, "audio.mp3");
      await ff([
        "-i",
        clip.file,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        audio,
      ]);
      segments = await transcribe(audio);
      if (
        segments.some(
          (s) => s.start > info.duration || s.end > info.duration + 1,
        )
      )
        throw new Error(
          "Transcription returned timestamps outside the video duration.",
        );
      await patchClip(id, { segments });
    }
    await patchClip(id, { stage: "Sampling visual moments" });
    const count = Math.ceil(info.duration / 6);
    const existing = clip.segments.filter((s) => s.kind === "visual");
    segments.push(...existing);
    for (let i = 0; i < count; i++) {
      const start = i * 6;
      if (existing.some((s) => s.start === start)) continue;
      const frame = path.join(
        dir,
        `frame-${String(i + 1).padStart(3, "0")}.jpg`,
      );
      try {
        await stat(frame);
      } catch {
        await ff([
          "-ss",
          String(start),
          "-i",
          clip.file,
          "-frames:v",
          "1",
          "-vf",
          "scale=640:-2",
          "-q:v",
          "4",
          frame,
        ]);
      }
      await patchClip(id, { stage: `Describing frame ${i + 1} of ${count}` });
      const description = await describeFrame(frame);
      segments.push({ start, end: start, kind: "visual", text: description });
      await patchClip(id, { segments: [...segments] });
    }
    if (!segments.length)
      throw new Error(
        "No searchable speech or visual descriptions were produced.",
      );
    await patchClip(id, { stage: "Saving semantic index" });
    const vectors = await embed(segments.map((s) => s.text));
    if (vectors.length !== segments.length)
      throw new Error("Embedding provider returned incomplete results.");
    segments = segments.map((s, i) => ({ ...s, embedding: vectors[i] }));
    await patchClip(id, {
      segments,
      status: "ready",
      stage: "Indexed",
      embeddingModel: embeddingModel(),
      error: undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Indexing failed";
    console.error(`[Clipdexer] Indexing failed for clip ${id}: ${message}`);
    await patchClip(id, {
      status: "error",
      error: message,
      stage: "Needs attention",
    });
  }
}
// Single-process durable queue: queued/processing records survive app restarts.
export function kickWorker() {
  if (state.clipWorker) return;
  state.clipWorker = (async () => {
    for (;;) {
      const clip = (await listClips()).find(
        (c) => c.status === "queued" || c.status === "processing",
      );
      if (!clip) break;
      await processClip(clip.id);
    }
  })().finally(() => {
    state.clipWorker = undefined;
  });
}
