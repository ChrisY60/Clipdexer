import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { Clip } from "./types";
export const dataDir =
  process.env.CLIPDEXER_DATA_DIR || path.join(process.cwd(), "data");
const db = path.join(dataDir, "clips.json");
const state = globalThis as typeof globalThis & {
  clipStoreLock?: Promise<unknown>;
};
export async function listClips(): Promise<Clip[]> {
  try {
    return JSON.parse(await readFile(db, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
export async function mutateClips(fn: (clips: Clip[]) => void) {
  const task = (state.clipStoreLock || Promise.resolve()).then(async () => {
    await mkdir(dataDir, { recursive: true });
    const clips = await listClips();
    fn(clips);
    await writeFile(db + ".tmp", JSON.stringify(clips));
    await rename(db + ".tmp", db);
  });
  state.clipStoreLock = task.catch(() => {});
  await task;
}
export async function saveClip(clip: Clip) {
  await mutateClips((clips) => {
    const i = clips.findIndex((c) => c.id === clip.id);
    if (i < 0) clips.push(clip);
    else clips[i] = clip;
  });
}
export async function patchClip(id: string, patch: Partial<Clip>) {
  await mutateClips((clips) => {
    const clip = clips.find((c) => c.id === id);
    if (clip) Object.assign(clip, patch);
  });
}
export function publicClip(clip: Clip): Clip {
  const { file, hash, owner, ...rest } = clip;
  void file;
  void hash;
  void owner;
  return {
    ...rest,
    segments: clip.segments.map(({ embedding, ...s }) => {
      void embedding;
      return s;
    }),
  };
}
