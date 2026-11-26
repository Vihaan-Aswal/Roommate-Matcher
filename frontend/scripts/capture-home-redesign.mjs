/**
 * Capture the refined homepage: top, each station section, the film and footer
 * at the four review widths.
 *
 * Start the dev server first:
 *   npm run dev
 * Then:
 *   node scripts/capture-home-redesign.mjs
 * Override with HOME_BASE_URL.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(repoRoot, "docs", "evidence", "home-redesign", "shots");
const baseUrl = process.env.HOME_BASE_URL ?? "http://127.0.0.1:5173";

const WIDTHS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "912x672", width: 912, height: 672 },
  { name: "375", width: 375, height: 812 },
];

const SECTIONS = [
  { name: "path", selector: ".mm-path" },
  { name: "film", selector: "#sample-run" },
  { name: "boundary", selector: "#boundary" },
  { name: "compatibility", selector: "#compatibility" },
  { name: "fairness", selector: "#fairness" },
  { name: "artifacts", selector: "#artifacts" },
  { name: "sign-off", selector: "#sign-off" },
  { name: "limits", selector: "#limits" },
  { name: "close", selector: ".mm-close" },
  { name: "footer", selector: ".mm-footer" },
];

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const viewport of WIDTHS) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
  });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);

  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-top.png`) });

  // Capture whole sections without the sticky header covering their head.
  await page.addStyleTag({
    content: ".mm-header{display:none!important}.mm-skip{display:none!important}",
  });

  for (const section of SECTIONS) {
    const element = page.locator(section.selector).first();
    if ((await element.count()) === 0) continue;
    await element.screenshot({
      path: path.join(outputDir, `${viewport.name}-${section.name}.png`),
    });
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(
    `${viewport.name}: overflow ${overflow}px; console errors ${consoleErrors.length}`,
  );
  if (consoleErrors.length > 0) console.log(consoleErrors);
  await page.close();
}

await browser.close();
console.log(`done: ${outputDir}`);
