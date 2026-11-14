/**
 * audit-redesign.mjs — mechanical checks no dependency can hide from.
 *
 * For every route: heading structure, accessible names on interactive
 * elements, horizontal overflow at 375, and whether any focusable element is
 * reachable with a visible focus ring.
 *
 *   node scripts/audit-redesign.mjs --base http://127.0.0.1:5175
 */
import { chromium } from "@playwright/test";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const base = arg("base", "http://127.0.0.1:5175");
const apiUrl = arg("api", "http://127.0.0.1:8000");

const demo = await (
  await fetch(`${apiUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@example.com" }),
  })
).json();
const auth = { Authorization: `Bearer ${demo.token}` };
const runs = await (
  await fetch(`${apiUrl}/api/workspaces/${demo.workspace_id}/matching/runs`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "all_ready_segments", segment_key: null }),
  })
).json();
const run = runs.runs?.[0] ?? runs;
const segments = await (
  await fetch(`${apiUrl}/api/workspaces/${demo.workspace_id}/segments`, { headers: auth })
).json();
const segmentKey = segments.segments?.[0]?.segment_key;
const formLink = await (
  await fetch(`${apiUrl}/api/workspaces/${demo.workspace_id}/form-link`, { headers: auth })
).json();

const ws = demo.workspace_id;
const routes = [
  { name: "login", url: "/login" },
  { name: "chooser", url: "/app", auth: true },
  { name: "dashboard", url: `/app/${ws}/dashboard`, auth: true },
  { name: "students-data", url: `/app/${ws}/students-data`, auth: true },
  { name: "form-collection", url: `/app/${ws}/form-collection`, auth: true },
  { name: "matching-runs", url: `/app/${ws}/matching-runs`, auth: true },
  {
    name: "rooms",
    url: run
      ? `/app/${ws}/matching-runs/${encodeURIComponent(run.run_id)}/rooms?segment=${encodeURIComponent(segmentKey)}&needsReview=0`
      : null,
    auth: true,
  },
  {
    name: "students",
    url: run
      ? `/app/${ws}/matching-runs/${encodeURIComponent(run.run_id)}/students?segment=all&label=all&atRisk=0`
      : null,
    auth: true,
  },
  {
    name: "fairness",
    url: run ? `/app/${ws}/fairness/${encodeURIComponent(run.run_id)}?segment=all` : null,
    auth: true,
  },
  { name: "manual-checker", url: `/app/${ws}/manual-checker?segment=${encodeURIComponent(segmentKey)}`, auth: true },
  { name: "student-form", url: `/f/${formLink.token}` },
];

const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });
const findings = [];

for (const route of routes) {
  if (!route.url) continue;
  for (const width of [375, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    if (route.auth) {
      await context.addInitScript(({ token }) => sessionStorage.setItem("demo_token", token), {
        token: demo.token,
      });
    }
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 120));
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error).slice(0, 120)));
    await page.goto(`${base}${route.url}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(500);

    const focus = [];
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Tab");
      focus.push(
        await page.evaluate(() => {
          const node = document.activeElement;
          if (!node) return "none";
          const style = getComputedStyle(node);
          return `${node.tagName.toLowerCase()}:${(node.textContent || "").trim().slice(0, 18)} outline=${style.outlineStyle}/${style.outlineWidth}`;
        }),
      );
    }

    const report = await page.evaluate(() => {
      const headingLevels = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(
        (node) => Number(node.tagName.slice(1)),
      );
      let orderBroken = false;
      for (let i = 1; i < headingLevels.length; i += 1) {
        if (headingLevels[i] - headingLevels[i - 1] > 1) orderBroken = true;
      }

      const interactive = Array.from(
        document.querySelectorAll("a,button,input,select,textarea,summary,[role=button],[role=checkbox]"),
      );
      const unnamed = interactive
        .filter((node) => {
          if (node.getAttribute("aria-hidden") === "true") return false;
          const text = (node.getAttribute("aria-label") || node.textContent || "").trim();
          const labelled =
            node.getAttribute("aria-labelledby") ||
            (node.id && document.querySelector(`label[for="${node.id}"]`)) ||
            node.closest("label");
          if (node.matches("input[type=file],input[type=checkbox],input[type=radio]")) {
            return !labelled && !node.getAttribute("aria-label");
          }
          if (node.matches("input,select,textarea")) {
            return !labelled && !node.getAttribute("aria-label") && !node.getAttribute("placeholder");
          }
          return text.length === 0 && !labelled;
        })
        .map((node) => `${node.tagName.toLowerCase()}.${(node.className || "").toString().slice(0, 40)}`)
        .slice(0, 5);

      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const wideElements = Array.from(document.querySelectorAll("body *"))
        .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 2)
        .map((node) => `${node.tagName.toLowerCase()}.${(node.className || "").toString().slice(0, 40)}`)
        .slice(0, 5);

      const landmarks = {
        main: document.querySelectorAll("main").length,
        nav: document.querySelectorAll("nav").length,
        h1: document.querySelectorAll("h1").length,
      };

      const smallTargets = Array.from(document.querySelectorAll("button,a")).filter((node) => {
        // A control wrapped in its own label inherits the label's hit area.
        if (node.closest("label")) return false;
        if (node.getAttribute("aria-hidden") === "true") return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.height < 24;
      }).map((node) => `${node.tagName.toLowerCase()}:"${(node.textContent || "").trim().slice(0, 24)}"`);

      return { headingLevels, orderBroken, unnamed, overflow, wideElements, landmarks, smallTargets };
    });

    findings.push({ route: route.name, width, consoleErrors, focus, ...report });
    await context.close();
  }
}

await browser.close();

let problems = 0;
for (const row of findings) {
  const issues = [];
  if (row.landmarks.h1 !== 1) issues.push(`h1 count ${row.landmarks.h1}`);
  if (row.landmarks.main !== 1) issues.push(`main count ${row.landmarks.main}`);
  if (row.orderBroken) issues.push(`heading order ${row.headingLevels.join(",")}`);
  if (row.unnamed.length) issues.push(`unnamed: ${row.unnamed.join(" | ")}`);
  if (row.overflow > 0) issues.push(`overflow ${row.overflow}px: ${row.wideElements.join(" | ")}`);
  if (row.smallTargets.length > 0) issues.push(`small targets: ${row.smallTargets.join(" | ")}`);
  if (row.consoleErrors.length > 0) issues.push(`console: ${row.consoleErrors.join(" | ")}`);
  const focusMissing = row.focus.filter((entry) => entry.includes("outline=none/") || entry.includes("outline=none")).length;
  if (focusMissing > 0) issues.push(`focus ring missing: ${row.focus.join(" | ")}`);
  if (issues.length) {
    problems += 1;
    console.log(`${row.route} @${row.width}: ${issues.join(" · ")}`);
  }
}
console.log(problems === 0 ? "CLEAN" : `${problems} route/width combinations need attention`);
