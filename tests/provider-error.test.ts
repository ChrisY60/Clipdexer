import { test } from "node:test";
import assert from "node:assert/strict";
import { providerError } from "../lib/provider-error";
test("billing 429 explains exhausted credits rather than suggesting a timed retry", async () => {
  const error = await providerError(
    Response.json(
      {
        error: { code: "credit_balance_exhausted", type: "insufficient_quota" },
      },
      { status: 429 },
    ),
    "Transcription",
  );
  assert.match(error.message, /credit balance is exhausted/);
  assert.doesNotMatch(error.message, /rate limit|Wait briefly/);
});
test("temporary rate limit respects provider retry delay", async () => {
  const error = await providerError(
    Response.json(
      { error: { code: "rate_limit_exceeded" } },
      { status: 429, headers: { "retry-after": "45" } },
    ),
    "Vision",
  );
  assert.match(error.message, /Wait at least 45 seconds/);
});
test("raw provider errors never disclose echoed secrets", async () => {
  const error = await providerError(
    Response.json(
      { error: { code: "invalid_api_key", message: "Invalid key sk-SECRET" } },
      { status: 401 },
    ),
    "Transcription",
  );
  assert.match(error.message, /credentials/);
  assert.doesNotMatch(error.message, /sk-SECRET/);
});
test("non-JSON errors retain safe actionable context", async () => {
  const error = await providerError(
    new Response("upstream crashed", { status: 503 }),
    "Embeddings",
  );
  assert.match(error.message, /HTTP 503/);
  assert.match(error.message, /temporarily unavailable/);
});
