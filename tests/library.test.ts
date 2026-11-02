import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryPage, visibleClips } from "../lib/library";
import { Clip } from "../lib/types";

const clips: Clip[] = Array.from({ length: 41 }, (_, i) => ({
  id: `clip-${String(i).padStart(3, "0")}`,
  title: `Clip ${i}`,
  source: i < 3 ? "sample" : "upload",
  status: i === 40 ? "processing" : "ready",
  createdAt: "2026-01-01T00:00:00.000Z",
  file: "private/path",
  hash: "private-hash",
  owner: "private-owner",
  segments: [
    {
      start: 0,
      end: 1,
      kind: "speech",
      text: "Private transcript",
      embedding: [1, 2, 3],
    },
  ],
}));

test("library caps pages and does not send saved indexes or server-private fields", () => {
  const result = libraryPage(clips, new URLSearchParams("limit=100000"));
  assert.equal(result.clips.length, 12);
  assert.equal(result.total, 41);
  assert.equal(result.pages, 4);
  assert.deepEqual(result.counts, { total: 41, ready: 40, pending: 1 });
  assert(
    result.clips.every((c) => c.segments.length === 0 && c.segmentCount === 1),
  );
  assert(!JSON.stringify(result).includes("Private transcript"));
  for (const field of ["file", "hash", "owner"])
    assert(!(field in result.clips[0]));
});
test("stable tie ordering has no duplicate or missing clips across pages", () => {
  const ids = [1, 2, 3, 4].flatMap((page) =>
    libraryPage(
      [...clips].reverse(),
      new URLSearchParams({ page: String(page) }),
    ).clips.map((c) => c.id),
  );
  assert.deepEqual(
    ids,
    clips.map((c) => c.id),
  );
});
test("filters run before pagination while counters cover the entire visible collection", () => {
  const result = libraryPage(
    clips,
    new URLSearchParams("filter=uploads&page=2"),
  );
  assert.equal(result.total, 38);
  assert.equal(result.counts.total, 41);
  assert.equal(result.clips[0].id, "clip-015");
  assert.equal(
    libraryPage(clips, new URLSearchParams("view=processing")).total,
    38,
  );
  assert.equal(
    libraryPage(clips, new URLSearchParams("filter=samples")).total,
    3,
  );
});
test("invalid pages, empty collections and deleted last-page items remain navigable", () => {
  for (const page of ["NaN", "-2", "1.5", "Infinity"])
    assert.equal(libraryPage(clips, new URLSearchParams({ page })).page, 1);
  assert.equal(libraryPage(clips, new URLSearchParams("page=99999")).page, 4);
  assert.deepEqual(libraryPage([], new URLSearchParams("page=4")).clips, []);
  assert.equal(libraryPage([], new URLSearchParams("page=4")).page, 1);
});
test("Twitch collection and detail candidates are isolated before pagination", () => {
  const all: Clip[] = [
    ...clips,
    { ...clips[0], id: "mine", source: "twitch", owner: "alice" },
    { ...clips[0], id: "theirs", source: "twitch", owner: "bob" },
  ];
  assert.deepEqual(
    visibleClips(all, "twitch", "alice").map((c) => c.id),
    ["mine"],
  );
  assert.deepEqual(visibleClips(all, "twitch"), []);
  assert.equal(visibleClips(all, "demo").length, 41);
});
