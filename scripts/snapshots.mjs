import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch();
try {
  await mkdir("test-results", { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 1050],
    ["mobile", 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2800);
    await page.screenshot({
      path: `test-results/${name}-final.png`,
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
