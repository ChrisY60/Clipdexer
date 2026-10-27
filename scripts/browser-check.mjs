import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
const browser = await chromium.launch();
const page = await browser.newPage({
  baseURL: "http://localhost:3000",
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });
let createdId;
const testTitle = `Browser test ${randomUUID()}`;
try {
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Preview Wait…" }).waitFor();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.getByRole("button", { name: /Purple shirt, talking/ }).click();
  await page.getByText("Strong keyword match").waitFor();
  assert.equal(await page.locator(".result-card").count(), 1);
  await page.getByRole("button", { name: /Bulgaria! I want/ }).click();
  await page.locator("video").waitFor();
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 1,
  );
  assert.equal(
    await page.locator("video").evaluate((v) => Math.round(v.currentTime)),
    18,
  );
  await page.locator("video").evaluate((v) => v.play());
  await page.waitForTimeout(500);
  assert((await page.locator("video").evaluate((v) => v.currentTime)) > 18);
  await page.screenshot({ path: "test-results/player.png" });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByLabel("Describe the clip you remember")
    .fill("underwater submarine astronaut");
  await page.getByRole("button", { name: "Find clip", exact: true }).click();
  await page
    .getByRole("heading", { name: "No confident match", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Add clips", exact: true }).click();
  assert.equal(
    (await (await page.request.get("/api/config")).json()).ai,
    false,
    "Run this browser fixture with AI disabled to avoid paid calls.",
  );
  const sample = await readFile("public/samples/purple.mp4");
  await page.locator("input[type=file]").setInputFiles({
    name: "browser-fixture.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.concat([sample, Buffer.from(testTitle)]),
  });
  await page.locator("input[name=title]").fill(testTitle);
  const uploadResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/clips") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save video for indexing" }).click();
  const uploaded = await (await uploadResponse).json();
  createdId = uploaded.id;
  await page.getByRole("heading", { name: "Behind the moments" }).waitFor();
  await page.getByText("needs config", { exact: false }).first().waitFor();
  assert(uploaded);
  assert.equal(uploaded.status, "needs_config");
  assert.equal(uploaded.segments.length, 0);
  assert(!uploaded.file);
  const range = await page.request.get(`/api/media/${uploaded.id}`, {
    headers: { range: "bytes=0-99" },
  });
  assert.equal(range.status(), 206);
  assert.equal((await range.body()).length, 100);
  const badRange = await page.request.get(`/api/media/${uploaded.id}`, {
    headers: { range: "bytes=999999999999-" },
  });
  assert.equal(badRange.status(), 416);
  const twitch = await page.request.get("/api/twitch/clips");
  assert.equal(twitch.status(), 401);
  const csrf = await page.request.post("/api/search", {
    headers: { Origin: "https://untrusted.example" },
    data: { query: "purple" },
  });
  assert.equal(csrf.status(), 400);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .locator(".nav-item.active")
    .filter({ hasText: "Discover" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: search, seeking/playback, no match, upload without credentials, byte ranges, Twitch auth, origin checks, mobile overflow.",
  );
} finally {
  if (createdId) {
    const db = path.resolve("data/clips.json");
    const clips = JSON.parse(await readFile(db, "utf8"));
    const fixture = clips.find(
      (c) => c.id === createdId && c.title === testTitle,
    );
    if (fixture) {
      const file = path.resolve(fixture.file);
      assert.equal(path.dirname(file), path.resolve("data/uploads"));
      assert.equal(path.basename(file), `${createdId}.mp4`);
      await unlink(file);
      await writeFile(
        db + ".browser.tmp",
        JSON.stringify(clips.filter((c) => c.id !== createdId)),
      );
      await rename(db + ".browser.tmp", db);
    }
  }
  await browser.close();
}
