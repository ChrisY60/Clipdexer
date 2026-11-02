import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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
    // Windows file scanners can briefly hold the destination and reject rename
    // with EPERM. A unique temporary file avoids colliding with stale writes.
    const temporary = `${db}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(clips));
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temporary, db);
          break;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (
            process.platform !== "win32" ||
            !["EPERM", "EBUSY", "EACCES"].includes(code || "") ||
            attempt >= 7
          )
            throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 25 * 2 ** attempt),
          );
        }
      }
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
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
export async function removeClip(id: string): Promise<Clip | undefined> {
  let removed: Clip | undefined;
  await mutateClips((clips) => {
    const index = clips.findIndex((clip) => clip.id === id);
    if (index < 0) return;
    [removed] = clips.splice(index, 1);
  });
  return removed;
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
