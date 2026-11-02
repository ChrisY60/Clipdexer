import { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Test-only media interception. No sample files are exposed by the application.
export async function routeFixtureMedia(page: Page) {
  await page.route("**/samples/*", async (route) => {
    const name = path.basename(new URL(route.request().url()).pathname);
    if (!/^(purple|game|cat)\.(svg|mp4)$/.test(name)) return route.abort();
    await route.fulfill({
      contentType: name.endsWith(".svg") ? "image/svg+xml" : "video/mp4",
      body: await readFile(path.join("tests/fixtures/media", name)),
    });
  });
}
