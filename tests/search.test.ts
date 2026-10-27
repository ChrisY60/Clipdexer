import { test } from "node:test";
import assert from "node:assert/strict";
import { rankClips, cosine } from "../lib/search";
import { samples } from "../lib/samples";
import { twitchUrl } from "../lib/http";
test("combines speech and visual evidence in the same clip", () => {
  const matches = rankClips(samples, "purple shirt talking about Bulgaria");
  assert.equal(matches[0].clip.id, "sample-purple");
  assert.equal(matches[0].confidence, "strong");
  assert(
    matches[0].evidence.some((s) => s.kind === "speech" && s.start === 18),
  );
  assert(
    matches[0].evidence.some((s) => s.kind === "visual" && s.start === 12),
  );
});
test("does not invent matches for absent evidence", () => {
  assert.deepEqual(rankClips(samples, "underwater submarine astronaut"), []);
});
test("partial conjunctions are explicitly weak", () => {
  const m = rankClips(samples, "purple shirt underwater submarine");
  assert.equal(m[0].confidence, "weak");
});
test("title alone does not constitute content evidence", () => {
  const c = {
    ...samples[0],
    title: "underwater submarine astronaut",
    segments: [],
  };
  assert.deepEqual(rankClips([c], "underwater submarine astronaut"), []);
});
test("unprocessed clips never enter search", () => {
  assert.deepEqual(
    rankClips([{ ...samples[0], status: "needs_config" }], "purple shirt"),
    [],
  );
});
test("semantic vectors work only with matching model and dimension", () => {
  const clip = {
    ...samples[0],
    embeddingModel: "test",
    segments: [
      {
        start: 2,
        end: 5,
        text: "A feline walks across a desk.",
        kind: "visual" as const,
        embedding: [1, 0],
      },
    ],
  };
  assert.equal(
    rankClips([clip], "kitty", [1, 0], "test")[0].confidence,
    "weak",
  );
  assert.deepEqual(rankClips([clip], "kitty", [1, 0], "other"), []);
  assert.equal(cosine([1], [1, 0]), 0);
});
test("Twitch URL validation blocks unrelated and unsafe links", () => {
  assert.equal(
    twitchUrl("https://clips.twitch.tv/TestSlug?foo=bar"),
    "https://clips.twitch.tv/TestSlug",
  );
  assert.throws(() => twitchUrl("https://example.com/a"));
  assert.throws(() => twitchUrl("javascript:alert(1)"));
  assert.throws(() => twitchUrl("https://twitch.tv/channel"));
});
test("quoted phrases cannot become strong matches from separate words", () => {
  const clip = {
    ...samples[0],
    segments: [
      {
        start: 0,
        end: 2,
        text: "A purple room. A green shirt.",
        kind: "visual" as const,
      },
    ],
  };
  assert.equal(rankClips([clip], '"purple shirt"')[0].confidence, "weak");
});
