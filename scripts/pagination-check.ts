import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { samples } from "../lib/samples";
import { libraryPage } from "../lib/library";
import { Clip } from "../lib/types";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const clips: Clip[] = Array.from({ length: 41 }, (_, i) => ({
    ...samples[0],
    id: `sample-${String(i).padStart(3, "0")}`,
    title: `Clip ${i}`,
    createdAt: "2026-01-01T00:00:00Z",
  }));
  let lists = 0,
    details = 0,
    failNext = false;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { ai: false, twitch: false, user: null } }),
  );
  await page.route("**/api/clips?*", async (r) => {
    const params = new URL(r.request().url()).searchParams;
    if (params.has("id")) {
      details++;
      await r.fulfill({ json: clips.find((c) => c.id === params.get("id")) });
    } else {
      lists++;
      if (failNext) {
        failNext = false;
        await r.fulfill({
          status: 503,
          json: { error: "Temporary library outage" },
        });
        return;
      }
      await r.fulfill({ json: libraryPage(clips, params) });
    }
  });
  try {
    await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Preview Clip 0", exact: true })
      .waitFor();
    assert.equal(await page.locator(".clip-card").count(), 12);
    assert.equal(details, 0);
    const before = lists;
    await page.waitForTimeout(4500);
    assert.equal(lists, before, "An idle library should not poll");
    await page
      .getByRole("button", { name: "Preview Clip 0", exact: true })
      .click();
    await page.getByText("Sample index evidence", { exact: true }).waitFor();
    assert.equal(
      details,
      1,
      "Opening a card should fetch its saved index once",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview Clip 12", exact: true })
      .waitFor();
    assert.equal(await page.locator(".clip-card").count(), 12);
    assert.equal(
      await page
        .getByRole("button", { name: "Preview Clip 0", exact: true })
        .count(),
      0,
    );
    assert(
      await page
        .getByRole("heading", { name: "The rabbit hole, organized." })
        .evaluate((el) => el === document.activeElement),
    );
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview Clip 24", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview Clip 36", exact: true })
      .waitFor();
    assert.equal(await page.locator(".clip-card").count(), 5);
    assert(
      await page
        .getByRole("button", { name: "Next", exact: true })
        .isDisabled(),
    );
    await page.getByRole("button", { name: "My uploads", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "This collection is waiting for its first moment.",
      })
      .waitFor();
    assert.equal(
      await page.getByRole("navigation", { name: "Clip pages" }).count(),
      0,
    );
    failNext = true;
    await page
      .getByRole("button", { name: "All moments", exact: true })
      .click();
    await page.getByText("Temporary library outage").waitFor();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview Clip 0", exact: true })
      .waitFor();
    assert.equal(await page.locator(".clip-card").count(), 12);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Pagination QA passed: 41 clips, bounded rendering, on-demand details, no idle polling, page navigation, global filters, error recovery, mobile overflow.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
