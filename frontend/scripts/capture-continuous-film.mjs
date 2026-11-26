import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:4173";
const out = path.resolve("..", "docs", "evidence", "continuous-film");
const frames = [0.3, 1.6, 2.9, 4.2, 5.5, 6.8, 7.4, 8.1, 9.4];
const viewports = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "1280", width: 1280, height: 900 },
  { name: "375", width: 375, height: 900 },
];

await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?continuous=1`, { waitUntil: "networkidle" });
  await page.locator(".cf-stage").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const pause = page.getByRole("button", { name: "Pause film", exact: true });
  if (await pause.count()) await pause.click();

  for (const time of frames) {
    const rail = page.locator(".cf-scrub");
    const box = await rail.boundingBox();
    const x = box.x + 2 + ((box.width - 4) * time) / 10;
    await page.mouse.click(x, box.y + box.height / 2);
    await page.waitForTimeout(550);
    await page.locator(".mm-continuous").screenshot({
      path: path.join(out, `${viewport.name}-${time.toFixed(1)}.png`),
    });
  }

  await page.screenshot({
    path: path.join(out, `full-${viewport.name}.png`),
    fullPage: false,
  });
  await context.close();
}

// The review's exact autoplay case: only the top of the stage is visible, no
// scrolling, reduced motion requested. The screenshot shows the viewport; the
// time and slider are logged for the report.
const autoplayContext = await browser.newContext({
  viewport: { width: 912, height: 672 },
  reducedMotion: "reduce",
});
const autoplayPage = await autoplayContext.newPage();
await autoplayPage.goto(`${baseUrl}/?continuous=1`, { waitUntil: "networkidle" });
await autoplayPage.waitForTimeout(1600);
const autoplay = await autoplayPage.evaluate(() => {
  const stage = document.querySelector(".cf-stage")?.getBoundingClientRect();
  const visible = stage
    ? Math.max(
        0,
        Math.min(stage.bottom, window.innerHeight) - Math.max(stage.top, 0),
      )
    : 0;
  return {
    time: document.querySelector(".cf-timecode")?.textContent ?? null,
    slider: document.querySelector(".cf-scrub")?.getAttribute("aria-valuenow"),
    button:
      document.querySelector('.mm-film-control[aria-label="Pause film"]') !== null
        ? "Pause"
        : "Play",
    scrollY: window.scrollY,
    stageTop: stage ? Math.round(stage.top) : null,
    stageBottom: stage ? Math.round(stage.bottom) : null,
    stageHeight: stage ? Math.round(stage.height) : null,
    visibleFraction: stage
      ? Number((visible / stage.height).toFixed(3))
      : null,
  };
});
console.log(`912x672 autoplay: ${JSON.stringify(autoplay)}`);
await autoplayPage.screenshot({
  path: path.join(out, "912x672-autoplay.png"),
});
await autoplayContext.close();

const videoDir = path.join(out, ".video");
await fs.mkdir(videoDir, { recursive: true });
const videoContext = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 900 } },
});
const videoPage = await videoContext.newPage();
await videoPage.goto(`${baseUrl}/?continuous=1`, { waitUntil: "networkidle" });
await videoPage
  .getByRole("group", { name: "Continuous sample run film" })
  .scrollIntoViewIfNeeded();
await videoPage
  .getByRole("button", { name: "Replay film", exact: true })
  .click();
await videoPage.waitForTimeout(10_500);
const video = videoPage.video();
await videoContext.close();
const recorded = await video.path();
const webm = path.join(out, "continuous-film-1280-recording.webm");
await fs.copyFile(recorded, webm);
await fs.rm(videoDir, { recursive: true, force: true });
await browser.close();

console.log(webm);
