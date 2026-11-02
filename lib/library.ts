import { Clip, ClipPage } from "./types";
import { publicClip } from "./store";

export const LIBRARY_PAGE_SIZE = 12;

export function visibleClips(
  clips: Clip[],
  mode: string | null,
  userId?: string,
) {
  return clips.filter((c) =>
    mode === "twitch"
      ? Boolean(userId && c.source === "twitch" && c.owner === userId)
      : c.source !== "twitch",
  );
}

export function clipSummary(clip: Clip): Clip {
  // Strip the index before serialization, including every embedding vector.
  return {
    ...publicClip({ ...clip, segments: [] }),
    segmentCount: clip.segments.length,
  };
}

export function libraryPage(clips: Clip[], params: URLSearchParams): ClipPage {
  const counts = {
    total: clips.length,
    ready: clips.filter((c) => c.status === "ready").length,
    pending: clips.filter(
      (c) => c.status === "queued" || c.status === "processing",
    ).length,
  };
  const filter = params.get("filter");
  const filtered = clips
    .filter((c) =>
      params.get("view") === "processing"
        ? c.source !== "sample" && c.status !== "link"
        : filter === "samples"
          ? c.source === "sample"
          : filter === "uploads"
            ? c.source !== "sample"
            : true,
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / LIBRARY_PAGE_SIZE));
  const requested = Number(params.get("page") || 1);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, pages)
      : 1;
  return {
    clips: filtered
      .slice((page - 1) * LIBRARY_PAGE_SIZE, page * LIBRARY_PAGE_SIZE)
      .map(clipSummary),
    page,
    pages,
    total: filtered.length,
    counts,
  };
}
