import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
test("real FFmpeg ingestion persists timestamped provider output and handles absent credentials", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "clipdexer-test-"));
  process.env.CLIPDEXER_DATA_DIR = dir;
  let calls = 0;
  const server = createServer(async (req, res) => {
    calls++;
    let body = "";
    for await (const part of req) body += part;
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/audio/transcriptions") {
      assert(body.includes("verbose_json"));
      res.end(
        JSON.stringify({
          segments: [{ start: 0.2, end: 1.4, text: "Testing a purple shirt." }],
        }),
      );
    } else if (req.url === "/chat/completions") {
      assert(body.includes("data:image/jpeg;base64,"));
      res.end(
        JSON.stringify({
          choices: [{ message: { content: "A purple test screen." } }],
        }),
      );
    } else if (req.url === "/embeddings") {
      const parsed = JSON.parse(body);
      res.end(
        JSON.stringify({
          data: parsed.input.map((_: string, index: number) => ({
            index,
            embedding: [1, 0.5, 0],
          })),
        }),
      );
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  process.env.AI_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.TRANSCRIPTION_BASE_URL = process.env.AI_BASE_URL;
  try {
    const file = path.join(dir, "fixture.mp4");
    execFileSync(process.env.FFMPEG_PATH || "ffmpeg", [
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=purple:s=320x180:r=10",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=16000",
      "-t",
      "2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      file,
    ]);
    const store = await import("../lib/store");
    const { kickWorker } = await import("../lib/pipeline");
    const clip = {
      id: "test-clip",
      title: "Integration fixture",
      file,
      source: "upload" as const,
      status: "queued" as const,
      segments: [],
      createdAt: new Date().toISOString(),
    };
    await store.saveClip(clip);
    kickWorker();
    const state = globalThis as typeof globalThis & {
      clipWorker?: Promise<void>;
    };
    await state.clipWorker;
    const saved = (await store.listClips())[0];
    assert.equal(saved.status, "ready", saved.error);
    assert.equal(saved.segments[0].start, 0.2);
    assert(saved.segments.some((s) => s.kind === "visual" && s.start === 0));
    assert(saved.segments.every((s) => s.embedding?.length === 3));
    const count = calls;
    kickWorker();
    await state.clipWorker;
    assert.equal(calls, count, "ready clips must not be reprocessed");
    delete process.env.OPENAI_API_KEY;
    await store.saveClip({ ...clip, id: "missing-key" });
    kickWorker();
    await state.clipWorker;
    const missing = (await store.listClips()).find(
      (c) => c.id === "missing-key",
    )!;
    assert.equal(missing.status, "needs_config");
    assert.deepEqual(missing.segments, []);
    assert.equal(calls, count);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert(path.basename(dir).startsWith("clipdexer-test-"));
    await rm(dir, { recursive: true, force: true });
  }
});
