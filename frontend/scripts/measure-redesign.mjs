/**
 * measure-redesign.mjs — a dependency-free performance proxy.
 *
 * Lighthouse is not installed and adding it is out of scope for this pass, so
 * this records the three numbers Lighthouse mostly moves: LCP, CLS and the
 * transferred bytes for the route. Run it against the same dev/preview server
 * before and after a change.
 *
 *   node scripts/measure-redesign.mjs --base http://127.0.0.1:4175 --out ../.impeccable/review/app/perf.json
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const base = arg("base", "http://127.0.0.1:5175");
const out = path.resolve(process.cwd(), arg("out", "../.impeccable/review/app/perf.json"));
const apiUrl = arg("api", "http://127.0.0.1:8000");

const demo = await (
  await fetch(`${apiUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@example.com" }),
  })
).json();

const routes = [
  { name: "home", url: "/", auth: false },
  { name: "login", url: "/login", auth: false },
  { name: "dashboard", url: `/app/${demo.workspace_id}/dashboard`, auth: true },
  { name: "matching-runs", url: `/app/${demo.workspace_id}/matching-runs`, auth: true },
];

const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });
const results = [];

for (const route of routes) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (route.auth) {
    await context.addInitScript(
      ({ token }) => sessionStorage.setItem("demo_token", token),
      { token: demo.token },
    );
  }
  await context.addInitScript(() => {
    window.__cls = 0;
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lcp = Math.max(window.__lcp, entry.startTime);
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  const page = await context.newPage();
  let transferred = 0;
  page.on("response", async (response) => {
    try {
      const headers = await response.allHeaders();
      transferred += Number(headers["content-length"] ?? 0);
    } catch {
      // Ignore responses without accessible headers.
    }
  });

  await page.goto(`${base}${route.url}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(600);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const resourceBytes = resources.reduce(
      (total, entry) => total + (entry.transferSize || 0),
      0,
    );
    return {
      lcp: Math.round(window.__lcp ?? 0),
      cls: Number((window.__cls ?? 0).toFixed(4)),
      domContentLoaded: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
      load: Math.round(navigation?.loadEventEnd ?? 0),
      resourceBytes,
      resourceCount: resources.length,
    };
  });

  results.push({ route: route.name, ...metrics, transferredBytes: transferred + metrics.resourceBytes });
  console.log(`${route.name}: LCP ${metrics.lcp}ms · CLS ${metrics.cls} · DCL ${metrics.domContentLoaded}ms · ${((transferred + metrics.resourceBytes) / 1024).toFixed(1)} kB`);
  await context.close();
}

await browser.close();
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify({ base, measuredAt: new Date().toISOString(), results }, null, 2));
console.log(`wrote ${out}`);
