/**
 * trace-motion.mjs — interaction frame + long-task evidence under CPU throttle.
 *
 * For each scenario: loads the page, samples frame gaps with requestAnimationFrame
 * around the interaction, records long tasks, and (optionally) a Playwright trace.
 *
 *   node scripts/trace-motion.mjs --base http://127.0.0.1:5175 \
 *     --out ../.impeccable/review/motion-app/baseline --scenario all --throttle 4
 *
 * Scenarios: dashboard-load, drawer-open, fairness-load, form-steps, login-demo.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const base = arg("base", "http://127.0.0.1:5175");
const out = path.resolve(process.cwd(), arg("out", "../.impeccable/review/motion-app/baseline"));
const api = arg("api", process.env.CAPTURE_API_URL ?? "http://127.0.0.1:8000");
const throttle = Number(arg("throttle", "4"));
const only = arg("scenario", "all");
const settled = process.argv.includes("--settled");
const motion = arg("motion", "full");

const demo = await (
  await fetch(`${api}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@example.com" }),
  })
).json();
const auth = { Authorization: `Bearer ${demo.token}` };
const runResponse = await (
  await fetch(`${api}/api/workspaces/${demo.workspace_id}/matching/runs`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "all_ready_segments", segment_key: null }),
  })
).json();
const run = runResponse.run_id ? runResponse : null;
const segments = await (
  await fetch(`${api}/api/workspaces/${demo.workspace_id}/segments`, { headers: auth })
).json();
const segmentKey = segments.segments?.[0]?.segment_key ?? "";
const formLink = await (
  await fetch(`${api}/api/workspaces/${demo.workspace_id}/form-link`, { headers: auth })
).json();

const ws = demo.workspace_id;
const runId = run?.run_id;

const scenarios = {
  "dashboard-load": {
    url: `/app/${ws}/dashboard`,
    auth: true,
    async interact() {
      // Load choreography: skeletons resolve, stage rules draw.
      await this.waitForTimeout(1400);
    },
  },
  "drawer-open": {
    url: runId
      ? `/app/${ws}/matching-runs/${encodeURIComponent(runId)}/students?segment=all&label=all&atRisk=0`
      : null,
    auth: true,
    async interact() {
      // Open the first student, then close it.
      await this.getByText("Demo A Student 001").first().click();
      await this.waitForTimeout(500);
      await this.getByRole("button", { name: "Close", exact: true }).click();
      await this.waitForTimeout(400);
    },
  },
  "fairness-load": {
    url: runId ? `/app/${ws}/fairness/${encodeURIComponent(runId)}?segment=all` : null,
    auth: true,
    async interact() {
      await this.waitForTimeout(1400);
    },
  },
  "form-steps": {
    url: `/f/${formLink.token}`,
    auth: false,
    async interact() {
      await this.getByLabel("Admission Number").fill("ADM0001");
      await this.getByLabel("Last 4 digits of Phone Number").fill("0001");
      await this.getByRole("button", { name: /continue to questions/i }).click();
      await this.waitForTimeout(500);
    },
  },
};

const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });
await fs.mkdir(out, { recursive: true });
const results = [];

for (const [name, scenario] of Object.entries(scenarios)) {
  if (!scenario.url) continue;
  if (only !== "all" && only !== name) continue;

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (scenario.auth) {
    await context.addInitScript(({ token }) => sessionStorage.setItem("demo_token", token), {
      token: demo.token,
    });
  }
  await context.addInitScript(({ mode }) => {
    if (mode !== "full") localStorage.setItem("mm-motion", mode);
  }, { mode: motion });
  await context.addInitScript(() => {
    window.__longTasks = [];
    window.__frameGaps = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({ start: Math.round(entry.startTime), duration: Math.round(entry.duration) });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // longtask unsupported
    }
    // Sample frame gaps for the whole session, capped so the buffer stays small.
    let last = 0;
    const sample = (time) => {
      if (last > 0) window.__frameGaps.push(Math.round(time - last));
      last = time;
      if (window.__frameGaps.length < 2000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: throttle });

  const tracePath = path.join(out, `trace-${name}.zip`);
  await context.tracing.start({ screenshots: false, snapshots: false });

  const started = Date.now();
  await page.goto(`${base}${scenario.url}`, { waitUntil: "domcontentloaded", timeout: 45000 });

  if (settled) {
    // Isolate the interaction: let the page finish loading, then reset the
    // frame/long-task buffers so the numbers describe the motion, not the bundle.
    await page.waitForTimeout(2600);
    await page.evaluate(() => {
      window.__frameGaps = [];
      window.__longTasks = [];
    });
  } else {
    await page.waitForTimeout(250);
  }

  await scenario.interact.call(page);
  const elapsed = Date.now() - started;

  const metrics = await page.evaluate(() => {
    const gaps = window.__frameGaps.filter((gap) => gap > 0);
    const sorted = [...gaps].sort((a, b) => b - a);
    const longTasks = window.__longTasks;
    return {
      frames: gaps.length,
      worstGap: sorted[0] ?? 0,
      p95Gap: sorted[Math.floor(sorted.length * 0.05)] ?? 0,
      over32: gaps.filter((gap) => gap > 32).length,
      over50: gaps.filter((gap) => gap > 50).length,
      longTasks: longTasks.length,
      longestTask: longTasks.reduce((max, task) => Math.max(max, task.duration), 0),
      totalBlocking: longTasks.reduce((total, task) => total + Math.max(0, task.duration - 50), 0),
    };
  });

  await context.tracing.stop({ path: tracePath });
  results.push({ scenario: name, throttle, motion, settled, elapsedMs: elapsed, ...metrics });
  console.log(
    `${name} @${throttle}x: ${metrics.frames} frames · worst ${metrics.worstGap}ms · p95 ${metrics.p95Gap}ms · >32ms ${metrics.over32} · >50ms ${metrics.over50} · long tasks ${metrics.longTasks} (longest ${metrics.longestTask}ms, TBT ${metrics.totalBlocking}ms)`,
  );
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(out, `frames-${motion}${settled ? "-settled" : ""}.json`), JSON.stringify({ throttle, motion, settled, results }, null, 2));
console.log(`wrote ${path.join(out, "frames.json")}`);
