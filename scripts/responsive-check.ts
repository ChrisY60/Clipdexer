import { routeFixtureMedia } from "./fixture-media";
import { libraryPage } from "../lib/library";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { samples } from "../tests/fixtures/clips";
import { rankClips } from "../lib/search";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await routeFixtureMedia(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("test-results", { recursive: true });
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { ai: false, twitch: false, user: null } }),
  );
  await page.route("**/api/clips?*", (r) =>
    r.fulfill({
      json: new URL(r.request().url()).searchParams.has("id")
        ? samples.find(
            (c) => c.id === new URL(r.request().url()).searchParams.get("id"),
          )
        : libraryPage(samples, new URL(r.request().url()).searchParams),
    }),
  );
  await page.route("**/api/search", async (r) => {
    const query = r.request().postDataJSON().query;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await r.fulfill({
      json: {
        results: rankClips(samples, query),
        notice: "Sample index evidence.",
      },
    });
  });
  async function fits(label: string) {
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${label}: page overflow`,
    );
    const dialog = page.getByRole("dialog");
    if (await dialog.count()) {
      assert(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `${label}: dialog overflow`,
      );
    }
  }
  try {
    for (const width of [320, 375, 390, 600, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 600 ? 740 : 900 });
      await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await fits(`${width} home`);
      for (const name of ["Discover", "Clip library", "Processing"]) {
        const nav = page.getByRole("button", { name: new RegExp(`^${name}`) });
        await nav.click();
        assert.equal(await nav.getAttribute("aria-current"), "page");
        await fits(`${width} ${name}`);
      }
      await page.keyboard.press("Control+k");
      const input = page.getByRole("textbox", {
        name: "Describe the clip you remember",
      });
      await input.waitFor();
      assert(
        await input.evaluate((el) => el === document.activeElement),
        "Search shortcut should focus search from another tab",
      );
      await input.fill("Purple shirt, talking about Bulgaria");
      await input.press("Enter");
      await page.getByText("Strong keyword match").waitFor();
      assert(
        await page
          .getByRole("heading", { name: "Found in the footage" })
          .evaluate((el) => el === document.activeElement),
        "Results heading should receive focus",
      );
      await fits(`${width} results`);
      await page
        .getByRole("button", { name: /Play .* at 00:/ })
        .first()
        .click();
      await fits(`${width} player`);
      await page.keyboard.press("Escape");
      for (const name of ["Add clips", "Settings & connections"]) {
        const opener = page.getByRole("button", { name, exact: true });
        await opener.click();
        await fits(`${width} ${name}`);
        await page.keyboard.press("Shift+Tab");
        for (let i = 0; i < 15; i++) {
          assert(
            await page
              .getByRole("dialog")
              .evaluate((el) => el.contains(document.activeElement)),
            "Focus escaped dialog",
          );
          await page.keyboard.press("Tab");
        }
        if (width === 320)
          await page.screenshot({
            path: `test-results/ux-320-${name.replaceAll(" ", "-")}.png`,
          });
        await page.keyboard.press("Escape");
        assert(
          await opener.evaluate((el) => el === document.activeElement),
          "Focus should return to opener",
        );
      }
      await page.getByRole("button", { name: "Discover", exact: true }).click();
      if ([320, 768, 1440].includes(width))
        await page.screenshot({
          path: `test-results/ux-${width}.png`,
          fullPage: true,
        });
      await input.fill("underwater giraffe playing a violin");
      await input.press("Enter");
      await page.getByRole("heading", { name: "No confident match" }).waitFor();
      await fits(`${width} no results`);
      console.log(
        `Passed ${width}px: navigation, shortcut, search, player, upload/settings dialogs, focus containment and restoration, empty results.`,
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
