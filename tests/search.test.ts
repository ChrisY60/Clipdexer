import { test } from "node:test";
import assert from "node:assert/strict";
import { rankClips, cosine, parseQuery } from "../lib/search";
import { samples } from "./fixtures/clips";
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
  const [match] = rankClips([c], "underwater submarine astronaut");
  // A title can surface the clip, but only as a weak match with no evidence.
  assert.equal(match.confidence, "weak");
  assert.equal(match.partial, true);
  assert.deepEqual(match.evidence, []);
  assert.match(match.explanation || "", /title/);
  assert.deepEqual(rankClips([c], "underwater submarine telescope"), []);
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
test("quotes allow noncontiguous wording", () => {
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
  assert.equal(rankClips([clip], '"purple shirt"').length, 1);
});

test("explicit speech and visual clues cannot be satisfied by the wrong modality", () => {
  const wrong = {
    ...samples[0],
    id: "wrong",
    segments: samples[0].segments.map((s) => ({
      ...s,
      kind: s.kind === "speech" ? ("visual" as const) : ("speech" as const),
    })),
  };
  const matches = rankClips(
    [wrong, samples[0]],
    "wearing purple and talking about Bulgaria",
  );
  assert.equal(matches[0].clip.id, samples[0].id);
  assert.equal(matches[0].confidence, "strong");
  assert(!matches.some((m) => m.clip.id === "wrong"));
  assert.deepEqual(
    parseQuery("wearing purple and talking about Bulgaria").clues.map(
      (c) => c.kind,
    ),
    ["visual", "speech"],
  );
});
test("both clues in a nearby moment outrank partial or distant evidence", () => {
  const distant = {
    ...samples[0],
    id: "distant",
    segments: samples[0].segments.map((s) =>
      s.kind === "speech"
        ? { ...s, start: s.start + 100, end: s.end + 100 }
        : s,
    ),
  };
  const partial = {
    ...samples[0],
    id: "partial",
    segments: samples[0].segments.filter((s) => s.kind === "visual"),
  };
  const matches = rankClips(
    [distant, partial, samples[0]],
    "wearing purple and talking about Bulgaria",
  );
  assert.equal(matches[0].clip.id, samples[0].id);
  assert(matches.slice(1).every((m) => m.confidence === "weak"));
  assert(
    matches
      .find((m) => m.clip.id === "partial")
      ?.explanation?.includes("speech"),
  );
});
test("common related wording matches without requiring a provider", () => {
  const clip = {
    ...samples[0],
    segments: [
      { start: 2, end: 4, kind: "speech" as const, text: "I am exhausted." },
    ],
  };
  assert.equal(rankClips([clip], "says tired")[0].confidence, "strong");
  assert.equal(rankClips([clip], 'says "tired"')[0].confidence, "strong");
});
test("quotes allow flexible wording but respect modality and word boundaries", () => {
  const clip = {
    ...samples[0],
    segments: [
      {
        start: 2,
        end: 4,
        kind: "speech" as const,
        text: "We visit Bulgaria today.",
      },
    ],
  };
  assert.equal(
    rankClips([clip], "says “visit Bulgaria”")[0].confidence,
    "strong",
  );
  assert.equal(rankClips([clip], 'says "visit today"').length, 1);
  assert.deepEqual(rankClips([clip], 'says "aria"'), []);
  assert.deepEqual(rankClips([clip], 'wearing "visit Bulgaria"'), []);
});
test("exclusions remove matching categories and content without becoming positive clues", () => {
  const gaming = { ...samples[0], id: "gaming", category: "Gaming" };
  assert.deepEqual(
    rankClips([gaming, samples[0]], "purple shirt, not the gaming clip").map(
      (m) => m.clip.id,
    ),
    [samples[0].id],
  );
  assert.deepEqual(rankClips(samples, 'purple shirt without "Bulgaria"'), []);
  assert.deepEqual(rankClips(samples, "not the gaming clip"), []);
  assert.equal(
    rankClips([samples[0]], "purple shirt not wearing green")[0].clip.id,
    samples[0].id,
  );
});
test("negation and cue words inside quotes remain literal speech", () => {
  const clip = {
    ...samples[0],
    segments: [
      {
        start: 1,
        end: 3,
        kind: "speech" as const,
        text: "Not the gaming clip. He says hello.",
      },
    ],
  };
  assert.equal(
    rankClips([clip], 'says "not the gaming clip"')[0].confidence,
    "strong",
  );
  assert.equal(
    rankClips([clip], 'says "he says hello"')[0].confidence,
    "strong",
  );
});
test("clue embeddings compare paraphrases only with the requested modality", () => {
  const clip = {
    ...samples[0],
    embeddingModel: "test",
    segments: [
      {
        start: 1,
        end: 3,
        kind: "visual" as const,
        text: "A plum-colored garment.",
        embedding: [1, 0],
      },
      {
        start: 4,
        end: 6,
        kind: "speech" as const,
        text: "Let us take a trip to Sofia.",
        embedding: [0, 1],
      },
    ],
  };
  const matches = rankClips(
    [clip],
    "wearing purple and talking about Bulgaria",
    undefined,
    "test",
    [
      [1, 0],
      [0, 1],
    ],
  );
  assert.equal(matches[0].evidence.length, 2);
  assert.equal(matches[0].confidence, "weak");
  assert.deepEqual(
    rankClips(
      [clip],
      'wearing "purple" and talking about Bulgaria',
      undefined,
      "test",
      [
        [1, 0],
        [0, 1],
      ],
    ),
    matches,
  );
  assert.deepEqual(
    rankClips(
      [clip],
      "wearing purple and talking about Bulgaria",
      undefined,
      "other",
      [
        [1, 0],
        [0, 1],
      ],
    ),
    [],
  );
});
