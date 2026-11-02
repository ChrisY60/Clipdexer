import { libraryPage } from "../lib/library";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { samples } from "../lib/samples";
import { rankClips } from "../lib/search";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    baseURL: "http://localhost:3000",
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("test-results", { recursive: true });
  // Isolate design QA from the user's uploaded media and paid AI providers.
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { ai: false, twitch: false, user: null } }),
  );
  await page.route("**/api/clips?*", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).searchParams.has("id")
        ? samples.find(
            (c) =>
              c.id === new URL(route.request().url()).searchParams.get("id"),
          )
        : libraryPage(samples, new URL(route.request().url()).searchParams),
    }),
  );
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        results: rankClips(samples, route.request().postDataJSON().query),
        notice: "Sample index evidence. No AI request made.",
      },
    }),
  );
  try {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2800);
    await page.screenshot({
      path: "test-results/editorial-desktop.png",
      fullPage: true,
    });
    assert.equal(await page.locator(".clip-card").count(), 3);
    assert(
      !/[\u2014\u2733\u2726]|\p{Extended_Pictographic}/u.test(
        await page.locator("body").innerText(),
      ),
      "Interface should contain no emojis, decorative stars or em dashes",
    );
    await page
      .getByRole("textbox", { name: "Describe the clip you remember" })
      .fill("Purple shirt, talking about Bulgaria");
    await page.getByRole("button", { name: "Find clip", exact: true }).click();
    await page.getByText("Strong keyword match").waitFor();
    await page.screenshot({
      path: "test-results/editorial-search.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: /Bulgaria! I want/ }).click();
    await page.waitForFunction(
      () => !!document.querySelector("video")?.readyState,
    );
    assert.equal(
      await page
        .locator("video")
        .evaluate((v) => Math.round((v as HTMLVideoElement).currentTime)),
      18,
    );
    await page.screenshot({ path: "test-results/editorial-player.png" });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add clips", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({ path: "test-results/editorial-upload.png" });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    for (const width of [390, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow at ${width}`,
      );
      await page.screenshot({
        path: `test-results/editorial-${width}.png`,
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      "Design QA passed: desktop, tablet, mobile, sample search, timestamp player, upload dialog, no forbidden symbols or runtime errors.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
