/**
 * motion-stills.mjs — frame stills at fixed times after a navigation.
 *
 *   node scripts/motion-stills.mjs --url /app/<ws>/dashboard --auth \
 *     --out ../.impeccable/review/motion-app/stills/dashboard --times 0,120,240,400,700,1200
 *
 * Times are milliseconds from the navigation commit. Each still is a full-page
 * PNG named `<label>-<ms>.png`.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const has = (name) => process.argv.includes(`--${name}`);

const base = arg("base", "http://127.0.0.1:5175");
const url = arg("url", "/");
const out = path.resolve(process.cwd(), arg("out", "../.impeccable/review/motion-app/stills"));
const label = arg("label", "still");
const times = arg("times", "0,120,240,400,700,1200").split(",").map(Number);
const width = Number(arg("width", "1280"));
const height = Number(arg("height", width >= 1280 ? "900" : width >= 768 ? "1024" : "812"));
const motion = arg("motion", "full");
const api = arg("api", process.env.CAPTURE_API_URL ?? "http://127.0.0.1:8000");

const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });
const context = await browser.newContext({ viewport: { width, height } });

let resolvedUrl = url;

if (has("auth")) {
  const demo = await (
    await fetch(`${api}/api/auth/demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@example.com" }),
    })
  ).json();
  await context.addInitScript(({ token }) => sessionStorage.setItem("demo_token", token), {
    token: demo.token,
  });

  resolvedUrl = resolvedUrl.replace(":ws", demo.workspace_id);

  if (resolvedUrl.includes(":run") || resolvedUrl.includes(":segment")) {
    const auth = { Authorization: `Bearer ${demo.token}` };
    const run = await (
      await fetch(`${api}/api/workspaces/${demo.workspace_id}/matching/runs`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all_ready_segments", segment_key: null }),
      })
    ).json();
    const segments = await (
      await fetch(`${api}/api/workspaces/${demo.workspace_id}/segments`, { headers: auth })
    ).json();
    resolvedUrl = resolvedUrl
      .replace(":run", encodeURIComponent(run.run_id ?? ""))
      .replace(":segment", encodeURIComponent(segments.segments?.[0]?.segment_key ?? ""));
  }
}

await context.addInitScript(({ mode }) => {
  if (mode !== "full") localStorage.setItem("mm-motion", mode);
}, { mode: motion });

const page = await context.newPage();
await fs.mkdir(out, { recursive: true });

const started = Date.now();
await page.goto(`${base}${resolvedUrl}`, { waitUntil: "commit", timeout: 45000 });

for (const target of times) {
  const wait = target - (Date.now() - started);
  if (wait > 0) await page.waitForTimeout(wait);
  const file = path.join(out, `${label}-${target}.png`);
  await page.screenshot({ path: file });
  console.log(`[still] ${target}ms -> ${file}`);
}

await browser.close();
