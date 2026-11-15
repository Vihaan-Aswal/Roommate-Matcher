/**
 * record-motion.mjs — video evidence for the transitions that matter.
 *
 *   node scripts/record-motion.mjs --base http://127.0.0.1:5175 \
 *     --out ../.impeccable/review/motion-app/video --scenario all
 *
 * Requires ffmpeg on PATH only if you want frames; the .webm files are the deliverable.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const base = arg("base", "http://127.0.0.1:5175");
const out = path.resolve(process.cwd(), arg("out", "../.impeccable/review/motion-app/video"));
const api = arg("api", process.env.CAPTURE_API_URL ?? "http://127.0.0.1:8000");
const only = arg("scenario", "all");
const width = Number(arg("width", "1280"));
const height = Number(arg("height", "900"));
const motion = arg("motion", "full");

const demo = await (
  await fetch(`${api}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@example.com" }),
  })
).json();
const auth = { Authorization: `Bearer ${demo.token}` };
const run = await (
  await fetch(`${api}/api/workspaces/${demo.workspace_id}/matching/runs`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "all_ready_segments", segment_key: null }),
  })
).json();
const ws = demo.workspace_id;
const runId = encodeURIComponent(run.run_id ?? "");

const scenarios = {
  "dashboard-load": {
    url: `/app/${ws}/dashboard`,
    async run(page) {
      await page.waitForTimeout(1800);
    },
  },
  "drawer": {
    url: `/app/${ws}/matching-runs/${runId}/students?segment=all&label=all&atRisk=0`,
    async run(page) {
      await page.getByText("Demo A Student 001").first().click();
      await page.waitForTimeout(700);
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.waitForTimeout(400);
    },
  },
  "route-change": {
    url: `/app/${ws}/dashboard`,
    async run(page) {
      await page.waitForTimeout(1200);
      await page.getByRole("link", { name: "Matching Runs", exact: true }).click();
      await page.waitForTimeout(900);
    },
  },
  "fairness-load": {
    url: `/app/${ws}/fairness/${runId}?segment=all`,
    async run(page) {
      await page.waitForTimeout(1800);
    },
  },
  "home-hero": {
    url: "/",
    auth: false,
    async run(page) {
      await page.waitForTimeout(6000);
    },
  },
  "login-load": {
    url: "/login",
    auth: false,
    async run(page) {
      await page.waitForTimeout(1400);
    },
  },
  "form-steps": {
    url: null, // filled below from the form link
    async run(page) {
      await page.waitForTimeout(800);
      await page.getByLabel("Admission Number").fill("ADM0001");
      await page.getByLabel("Last 4 digits of Phone Number").fill("0001");
      await page.getByRole("button", { name: /continue to questions/i }).click();
      await page.waitForTimeout(900);
    },
  },
};

const formLink = await (
  await fetch(`${api}/api/workspaces/${demo.workspace_id}/form-link`, { headers: auth })
).json();
scenarios["form-steps"].url = `/f/${formLink.token}`;

await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });
const written = [];

for (const [name, scenario] of Object.entries(scenarios)) {
  if (!scenario.url) continue;
  if (only !== "all" && only !== name) continue;

  const dir = path.join(out, `raw-${name}`);
  await fs.mkdir(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir, size: { width, height } },
  });
  await context.addInitScript(({ token, mode, auth }) => {
    if (auth) sessionStorage.setItem("demo_token", token);
    if (mode !== "full") localStorage.setItem("mm-motion", mode);
  }, { token: demo.token, mode: motion, auth: scenario.auth !== false });

  const page = await context.newPage();
  await page.goto(`${base}${scenario.url}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await scenario.run(page);
  const video = page.video();
  await context.close();
  const raw = await video?.path();
  if (raw) {
    const target = path.join(out, `${name}${motion === "full" ? "" : `-${motion}`}.webm`);
    await fs.copyFile(raw, target);
    await fs.rm(dir, { recursive: true, force: true });
    written.push(target);
    console.log(`[video] ${target}`);
  }
}

await browser.close();
console.log(JSON.stringify({ written }, null, 2));
