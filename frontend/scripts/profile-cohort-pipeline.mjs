/**
 * Profile the cohort-pipeline film on the production build.
 *
 * Usage (from frontend/):
 *   node scripts/profile-cohort-pipeline.mjs 912 672
 *   node scripts/profile-cohort-pipeline.mjs 1440 900
 *
 * It prints long tasks around initial mount, rail seek and the automatic
 * Form -> Boundaries -> Score transition, and writes the raw trace events to
 * docs/evidence/perf/trace-<w>x<h>.json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const baseUrl = process.env.PERF_BASE_URL ?? "http://127.0.0.1:4175";
const width = Number(process.argv[2] ?? 912);
const height = Number(process.argv[3] ?? 672);
const label = `${width}x${height}`;
const outDir = path.join(repoRoot, "docs", "evidence", "perf");
const tracePath = path.join(outDir, `trace-${label}.json`);

const initScript = () => {
  window.__perf = { longTasks: [], marks: [] };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__perf.longTasks.push({
        start: entry.startTime,
        duration: entry.duration,
        name: entry.name,
        attribution: entry.attribution?.map((item) => ({
          name: item.name,
          containerType: item.containerType,
          containerName: item.containerName,
        })),
      });
    }
  });
  observer.observe({ type: "longtask", buffered: true });
  window.__mark = (name) => {
    const time = performance.now();
    performance.mark(name);
    window.__perf.marks.push({ name, time });
  };
  document.addEventListener("DOMContentLoaded", () => {
    const stage = document.querySelector(".cp-stage");
    if (!stage) return;
    new MutationObserver(() => {
      window.__mark(`step-${stage.dataset.step}`);
    }).observe(stage, { attributes: true, attributeFilter: ["data-step"] });
  });
};

async function readPerf(page) {
  return page.evaluate(() => window.__perf);
}

async function startTrace(page) {
  const session = await page.context().newCDPSession(page);
  const events = [];
  session.on("Tracing.dataCollected", (payload) => {
    events.push(...payload.value);
  });
  const complete = new Promise((resolve) => {
    session.once("Tracing.tracingComplete", resolve);
  });
  await session.send("Tracing.start", {
    categories: "devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline",
  });
  return { session, events, complete };
}

async function stopTrace(trace) {
  await trace.session.send("Tracing.end");
  await trace.complete;
  await trace.session.detach();
  return trace.events;
}

function tasksOver50(events) {
  return events
    .filter((event) => event.name === "RunTask" && event.dur > 50_000)
    .map((event) => ({
      name: event.name,
      start: event.ts / 1000,
      duration: event.dur / 1000,
      thread: event.tid,
      children: events
        .filter(
          (child) =>
            child.tid === event.tid &&
            child.ts >= event.ts &&
            child.ts + (child.dur ?? 0) <= event.ts + event.dur + 1000 &&
            child !== event &&
            child.name !== "RunTask",
        )
        .map((child) => ({
          name: child.name,
          start: (child.ts - event.ts) / 1000,
          duration: (child.dur ?? 0) / 1000,
          args: child.args,
        }))
        .filter((child) => child.duration >= 1)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8),
    }))
    .sort((a, b) => b.duration - a.duration);
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width, height },
  reducedMotion: "reduce",
});
const page = await context.newPage();
await context.addInitScript(initScript);

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);
await page.evaluate(() => window.__mark("initial-settled"));
const initial = await readPerf(page);

await page.evaluate(() => window.__mark("seek-start"));
const seekTrace = await startTrace(page);
await page.evaluate(() => {
  const input = document.querySelector(".cp-scrub");
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  ).set;
  setter.call(input, "7.5");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  window.__mark("seek-end");
});
await page.waitForTimeout(900);
const seekEvents = await stopTrace(seekTrace);
const afterSeek = await readPerf(page);

await page.getByRole("button", { name: /^02 Form/ }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "Play pipeline", exact: true }).click();
await page.waitForTimeout(150);
const playStep = await page.evaluate(() => {
  window.__mark("auto-run-start");
  return {
    time: document.querySelector(".cp-timecode")?.textContent,
    step: document.querySelector(".cp-stage")?.dataset.step,
  };
});
const autoTrace = await startTrace(page);
await page.waitForTimeout(12_500);
const autoEnd = await page.evaluate(() => ({
  time: document.querySelector(".cp-timecode")?.textContent,
  step: document.querySelector(".cp-stage")?.dataset.step,
}));
const autoEvents = await stopTrace(autoTrace);
const afterAuto = await readPerf(page);

await fs.writeFile(
  tracePath,
  JSON.stringify({ label, seekEvents, autoEvents }, null, 0),
);

const since = (perf, start) =>
  perf.longTasks.filter((task) => task.start >= start);
const initialMark =
  initial.marks.find((mark) => mark.name === "initial-settled")?.time ?? 0;
const seekMark =
  afterSeek.marks.find((mark) => mark.name === "seek-start")?.time ?? 0;
const autoMark =
  afterAuto.marks.find((mark) => mark.name === "auto-run-start")?.time ?? 0;

console.log(
  JSON.stringify(
    {
      label,
      playStep,
      autoEnd,
      initialLongTasks: initial.longTasks.filter((task) => task.start < initialMark),
      seekLongTasks: since(afterSeek, seekMark),
      autoLongTasks: since(afterAuto, autoMark),
      marks: afterAuto.marks.filter((mark) =>
        ["initial-settled", "seek-start", "seek-end", "auto-run-start"].includes(
          mark.name,
        ) || mark.name.startsWith("step-"),
      ),
      seekTraceTasks: tasksOver50(seekEvents).map((task) => ({
        start: task.start,
        duration: task.duration,
        children: task.children.map((child) => `${child.name} ${child.duration}ms`),
      })),
      autoTraceTasks: tasksOver50(autoEvents).map((task) => ({
        start: task.start,
        duration: task.duration,
        children: task.children.map((child) => `${child.name} ${child.duration}ms`),
      })),
      consoleErrors,
    },
    null,
    2,
  ),
);

await browser.close();
