/**
 * Capture the cohort-pipeline spike: review frames at the four test widths and
 * a ten-second VP9 screen take assembled from exact playhead samples.
 *
 * Start the dev server first:
 *   npm run dev
 * Then:
 *   node scripts/capture-cohort-pipeline.mjs
 * Override the origin with PIPELINE_BASE_URL.
 */
import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(repoRoot, "docs", "evidence", "cohort-pipeline");
const framesDir = path.join(outputDir, "shots");
const baseUrl = process.env.PIPELINE_BASE_URL ?? "http://127.0.0.1:5173";
const times = [0.5, 2, 3.5, 5, 7, 8.5, 9.5];
const VIDEO_FPS = 25;

await fs.mkdir(framesDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function openPage(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?pipeline=1`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".cp-film").scrollIntoViewIfNeeded();
  return { context, page };
}

async function seek(page, time) {
  await page.evaluate((value) => {
    const input = document.querySelector(".cp-scrub");
    if (!input) throw new Error("No pipeline slider");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, time);
  await page.waitForTimeout(80);
}

async function captureFrames(name, width, height, selectedTimes = times) {
  const { context, page } = await openPage(width, height);
  for (const time of selectedTimes) {
    await seek(page, time);
    await page.locator(".cp-film").screenshot({
      path: path.join(framesDir, `${name}-frame-${time.toFixed(1)}.png`),
    });
  }
  await context.close();
  console.log(`frames: ${name}`);
}

await captureFrames("1440", 1440, 900);
await captureFrames("375", 375, 812);
await captureFrames("912x672", 912, 672, [7, 8.5, 9.5]);
await captureFrames("1280", 1280, 800, [9.5]);

function findFfmpeg() {
  const local = process.env.LOCALAPPDATA;
  const candidates = [
    process.env.FFMPEG_PATH,
    local
      ? path.join(local, "ms-playwright", "ffmpeg-1013", "ffmpeg-win64.exe")
      : null,
    local
      ? path.join(local, "ms-playwright", "ffmpeg-1011", "ffmpeg-win64.exe")
      : null,
    "ffmpeg",
  ].filter(Boolean);
  return candidates.find(
    (candidate) => candidate === "ffmpeg" || fsSync.existsSync(candidate),
  );
}

const ffmpeg = findFfmpeg();
const videoPath = path.join(outputDir, "cohort-pipeline-10s.webm");

if (!ffmpeg) {
  console.warn("ffmpeg not found; skipped the video capture.");
} else {
  const { context, page } = await openPage(912, 840);
  const ffmpegProcess = spawn(
    ffmpeg,
    [
      "-y",
      "-f",
      "image2pipe",
      "-c:v",
      "mjpeg",
      "-i",
      "pipe:0",
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "1.4M",
      "-pix_fmt",
      "yuv420p",
      "-vf",
      "scale=864:-2",
      "-r",
      String(VIDEO_FPS),
      videoPath,
    ],
    { stdio: ["pipe", "ignore", "inherit"] },
  );
  ffmpegProcess.stdin.on("error", (error) => {
    console.warn("video pipe closed:", error.message);
  });

  const frameCount = 10 * VIDEO_FPS;
  for (let frame = 0; frame < frameCount; frame += 1) {
    await seek(page, frame / VIDEO_FPS);
    const jpeg = await page.locator(".cp-film").screenshot({
      type: "jpeg",
      quality: 88,
    });
    if (!ffmpegProcess.stdin.write(jpeg)) {
      await new Promise((resolve) => ffmpegProcess.stdin.once("drain", resolve));
    }
  }
  ffmpegProcess.stdin.end();
  await new Promise((resolve, reject) => {
    ffmpegProcess.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });
  await context.close();
  console.log(`video: ${videoPath}`);
}

await browser.close();
console.log(`done: ${outputDir}`);
