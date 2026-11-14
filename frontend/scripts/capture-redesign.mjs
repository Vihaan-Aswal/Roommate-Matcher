/**
 * capture-redesign.mjs — screenshot harness for the app-redesign pass.
 *
 * Creates a throwaway demo workspace through the public API (read/write on the
 * local dev DB only), runs matching once so results pages have artifacts, then
 * captures every route at 375 / 768 / 1280 / 1920.
 *
 * Usage (from frontend/):
 *   node scripts/capture-redesign.mjs --out ../.impeccable/review/app/baseline --tag before
 *   node scripts/capture-redesign.mjs --only dashboard,rooms --widths 1280,375
 *   node scripts/capture-redesign.mjs --list
 *
 * CORS: the backend allowlist only knows port 5173, so captures run on this
 * harness's own port (5175) with --disable-web-security. Screenshot-only.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function parseArgs(argv) {
  const args = { out: ".impeccable/review/app/baseline", tag: "", only: "", widths: "375,768,1280,1920", list: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, "");
    if (key === "list" || key === "debug" || key === "view" || key === "strip") {
      args[key] = true;
      continue;
    }
    args[key] = argv[i + 1];
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv);
const appUrl = process.env.CAPTURE_APP_URL ?? "http://127.0.0.1:5175";
const apiUrl = process.env.CAPTURE_API_URL ?? "http://127.0.0.1:8000";
const outDir = path.resolve(repoRoot, args.out);
const widths = args.widths.split(",").map((value) => Number(value.trim()));

async function api(url, init = {}) {
  const response = await fetch(`${apiUrl}${url}`, init);
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} -> ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function bootstrap() {
  const demo = await api("/api/auth/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@example.com" }),
  });
  const auth = { Authorization: `Bearer ${demo.token}` };
  const ws = demo.workspace_id;

  const run = await api(`/api/workspaces/${ws}/matching/runs`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "all_ready_segments", segment_key: null }),
  });
  const segments = await api(`/api/workspaces/${ws}/segments`, { headers: auth });
  const segmentKey = segments.segments?.[0]?.segment_key ?? "";
  const students = await api(`/api/workspaces/${ws}/matching/runs/${run.run_id}/students/all-segments`, { headers: auth });
  const firstStudent =
    (students.segments ?? []).flatMap((segment) => segment.students ?? [])[0]?.admission_number ?? "";
  const formLink = await api(`/api/workspaces/${ws}/form-link`, { headers: auth });

  // A workspace with nothing in it — the real empty state.
  const empty = await api("/api/workspaces", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Untitled workspace" }),
  });

  const platformToken = JSON.parse(
    await fs.readFile(path.join(process.env.TEMP ?? "/tmp", "mm_platform_token.json"), "utf8"),
  ).token;
  const tenants = await api("/api/platform/tenants?include_demo=false", {
    headers: { Authorization: `Bearer ${platformToken}` },
  });
  const tenant = tenants.tenants?.[0];

  return {
    token: demo.token,
    workspaceId: ws,
    runId: run.run_id,
    segmentKey,
    student: firstStudent,
    formToken: formLink.token,
    emptyWorkspaceId: empty.id,
    platformToken,
    platformTenantId: tenant?.id,
  };
}

function buildTargets(ctx) {
  const ws = ctx.workspaceId;
  const run = encodeURIComponent(ctx.runId);
  const seg = encodeURIComponent(ctx.segmentKey);
  const app = `/app/${ws}`;
  return [
    { name: "home", url: "/", auth: "demo" },
    { name: "login", url: "/login", auth: "none" },
    { name: "chooser", url: "/app", auth: "demo", ready: "Select a workspace" },
    { name: "dashboard", url: `${app}/dashboard`, auth: "demo", ready: "Dashboard" },
    { name: "dashboard-empty", url: `/app/${ctx.emptyWorkspaceId}/dashboard`, auth: "demo", ready: "Dashboard" },
    { name: "students-data", url: `${app}/students-data`, auth: "demo", ready: "Students & Data" },
    { name: "form-collection", url: `${app}/form-collection`, auth: "demo", ready: "Form & Collection" },
    { name: "matching-runs", url: `${app}/matching-runs`, auth: "demo", ready: "Matching Runs" },
    { name: "rooms", url: `${app}/matching-runs/${run}/rooms?segment=${seg}&needsReview=0`, auth: "demo", ready: "Room Results" },
    { name: "rooms-review", url: `${app}/matching-runs/${run}/rooms?segment=${seg}&needsReview=1`, auth: "demo", ready: "Room Results" },
    { name: "students-results", url: `${app}/matching-runs/${run}/students?segment=all&label=all&atRisk=0`, auth: "demo", ready: "Student Results" },
    { name: "students-risk", url: `${app}/matching-runs/${run}/students?segment=all&label=all&atRisk=1`, auth: "demo", ready: "Student Results" },
    { name: "student-detail", url: `${app}/matching-runs/${run}/students?segment=all&label=all&atRisk=0&student=${ctx.student}`, auth: "demo", ready: "Student Results" },
    { name: "fairness", url: `${app}/fairness/${run}?segment=all`, auth: "demo", ready: "Reports & Fairness" },
    { name: "manual-checker", url: `${app}/manual-checker?segment=${seg}`, auth: "demo", ready: "Manual Checker" },
    { name: "student-form", url: `/f/${ctx.formToken}`, auth: "none" },
    { name: "student-form-invalid", url: "/f/not-a-real-token", auth: "none" },
    { name: "platform-tenants", url: "/platform", auth: "platform" },
    {
      name: "platform-workspaces",
      url: `/platform/tenants/${args.tenant ?? ctx.platformTenantId}/workspaces`,
      auth: "platform",
    },
    { name: "not-found", url: "/this-route-does-not-exist", auth: "none" },
  ];
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const ctx = await bootstrap();
  let targets = buildTargets(ctx);
  if (args.only) {
    const wanted = new Set(args.only.split(",").map((value) => value.trim()));
    targets = targets.filter((target) => wanted.has(target.name));
  }
  if (args.list) {
    console.log(JSON.stringify({ ctx, targets: targets.map((t) => t.name) }, null, 2));
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-web-security"],
  });
  const written = [];
  try {
    for (const target of targets) {
      const token = target.auth === "platform" ? ctx.platformToken : target.auth === "demo" ? ctx.token : null;
      const context = await browser.newContext();      if (token) {
        await context.addInitScript(
          ({ value }) => {
            sessionStorage.setItem("demo_token", value);
          },
          { value: token },
        );
      }
      await context.addInitScript(() => {
        localStorage.setItem("mm-capture", "1");
      });
      for (const width of widths) {
        const page = await context.newPage();
        if (args.debug) {
          page.on("console", (message) => {
            if (message.type() === "error") console.log(`  [console] ${message.text().slice(0, 200)}`);
          });
          page.on("requestfailed", (request) => {
            console.log(`  [requestfailed] ${request.url().slice(0, 120)} ${request.failure()?.errorText ?? ""}`);
          });
          page.on("response", (response) => {
            if (response.url().includes("/api/")) {
              console.log(`  [api] ${response.status()} ${response.url().slice(0, 130)}`);
            }
          });
        }
        await page.setViewportSize({ width, height: width >= 1280 ? 900 : width >= 768 ? 1024 : 812 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`${appUrl}${target.url}`, { waitUntil: "networkidle", timeout: 45000 });
        if (target.ready) {
          await page.getByText(target.ready, { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
        }
        await page.waitForTimeout(400);
        if (args.strip) {
          await page.evaluate(() => {
            document
              .querySelectorAll('style[data-vite-dev-id*="app/desk.css"]')
              .forEach((node) => node.remove());
          });
          await page.waitForTimeout(150);
        }
        const file = path.join(outDir, `${args.tag ? `${args.tag}-` : ""}${target.name}-${width}.png`);
        try {
          await page.screenshot({ path: file, fullPage: !args.view });
        } catch (error) {
          console.log(`  [retry] ${target.name} @${width}: ${String(error).slice(0, 120)}`);
          await page.screenshot({ path: file, fullPage: false });
        }
        written.push(file);
        await page.close();
      }
      await context.close();
      console.log(`[capture] ${target.name}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`[capture] ${written.length} files -> ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
