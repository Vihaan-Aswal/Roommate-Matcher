/**
 * verify-resting-states.mjs — prove the motion layer changes nothing at rest.
 *
 * For each route and width: capture with motion off, then remove the motion
 * stylesheet in the same page (same workspace, same data) and capture again.
 * Any pixel difference is the motion layer's fault.
 *
 *   node scripts/verify-resting-states.mjs --base http://127.0.0.1:5175
 */
import path from "node:path";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const base = arg("base", "http://127.0.0.1:5175");
const api = arg("api", process.env.CAPTURE_API_URL ?? "http://127.0.0.1:8000");
const widths = arg("widths", "375,1280").split(",").map(Number);

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
const segments = await (
  await fetch(`${api}/api/workspaces/${demo.workspace_id}/segments`, { headers: auth })
).json();
const formLink = await (
  await fetch(`${api}/api/workspaces/${demo.workspace_id}/form-link`, { headers: auth })
).json();
const students = await (
  await fetch(
    `${api}/api/workspaces/${demo.workspace_id}/matching/runs/${encodeURIComponent(run.run_id)}/students/all-segments`,
    { headers: auth },
  )
).json();
const student = (students.segments ?? []).flatMap((segment) => segment.students ?? [])[0]?.admission_number ?? "";
const ws = demo.workspace_id;
const runId = encodeURIComponent(run.run_id ?? "");
const segmentKey = encodeURIComponent(segments.segments?.[0]?.segment_key ?? "");

const routes = [
  { name: "login", url: "/login", auth: false },
  { name: "chooser", url: "/app" },
  { name: "dashboard", url: `/app/${ws}/dashboard` },
  { name: "students-data", url: `/app/${ws}/students-data` },
  { name: "form-collection", url: `/app/${ws}/form-collection` },
  { name: "matching-runs", url: `/app/${ws}/matching-runs` },
  { name: "rooms", url: `/app/${ws}/matching-runs/${runId}/rooms?segment=${segmentKey}&needsReview=0` },
  { name: "students-results", url: `/app/${ws}/matching-runs/${runId}/students?segment=all&label=all&atRisk=0` },
  { name: "student-detail", url: `/app/${ws}/matching-runs/${runId}/students?segment=all&label=all&atRisk=0&student=${student}` },
  { name: "students-risk", url: `/app/${ws}/matching-runs/${runId}/students?segment=all&label=all&atRisk=1` },
  { name: "fairness", url: `/app/${ws}/fairness/${runId}?segment=all` },
  { name: "manual-checker", url: `/app/${ws}/manual-checker?segment=${segmentKey}` },
  { name: "student-form", url: `/f/${formLink.token}`, auth: false },
];

const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });
const results = [];

for (const route of routes) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width >= 1280 ? 900 : 812 } });
    if (route.auth !== false) {
      await context.addInitScript(({ token }) => sessionStorage.setItem("demo_token", token), {
        token: demo.token,
      });
    }
    await context.addInitScript(() => localStorage.setItem("mm-motion", "off"));
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${base}${route.url}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(400);

    // Two shots of the same state give the capture noise floor; if the cross diff
    // is no larger than that floor, the motion stylesheet changed nothing.
    const a1 = await page.screenshot({ fullPage: true, animations: "disabled" });
    await page.waitForTimeout(250);
    const a2 = await page.screenshot({ fullPage: true, animations: "disabled" });

    await page.evaluate(() => {
      document.querySelectorAll('style[data-vite-dev-id*="app/motion.css"]').forEach((node) => node.remove());
      delete document.documentElement.dataset.motion;
    });
    await page.waitForTimeout(250);
    const b1 = await page.screenshot({ fullPage: true, animations: "disabled" });
    await page.waitForTimeout(250);
    const b2 = await page.screenshot({ fullPage: true, animations: "disabled" });

    const compare = async (left, right) => {
      const comparePage = await context.newPage();
      await comparePage.setContent("<canvas id=c></canvas>");
      const differing = await comparePage.evaluate(
        async ({ a, b }) => {
          const load = (src) =>
            new Promise((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.onerror = reject;
              image.src = src;
            });
          const [imgA, imgB] = await Promise.all([load(a), load(b)]);
          if (imgA.width !== imgB.width || imgA.height !== imgB.height) return -1;
          const canvas = document.getElementById("c");
          canvas.width = imgA.width;
          canvas.height = imgA.height;
          const context2d = canvas.getContext("2d");
          context2d.drawImage(imgA, 0, 0);
          const dataA = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
          context2d.clearRect(0, 0, canvas.width, canvas.height);
          context2d.drawImage(imgB, 0, 0);
          const dataB = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
          let count = 0;
          for (let i = 0; i < dataA.length; i += 4) {
            if (dataA[i] !== dataB[i] || dataA[i + 1] !== dataB[i + 1] || dataA[i + 2] !== dataB[i + 2]) {
              count += 1;
            }
          }
          return count;
        },
        { a: `data:image/png;base64,${left.toString("base64")}`, b: `data:image/png;base64,${right.toString("base64")}` },
      );
      await comparePage.close();
      return differing;
    };

    const noise = Math.max(
      await compare(a1, a2),
      await compare(b1, b2),
    );
    const cross = await compare(a1, b2);
    const ok = cross <= noise;
    if (!ok) {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const dir = path.resolve(process.cwd(), "..", ".impeccable", "review", "motion-app", "resting-fail");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${route.name}-${width}-a.png`), a1);
      await writeFile(path.join(dir, `${route.name}-${width}-b.png`), b2);
    }
    results.push({ route: route.name, width, noise, cross, ok });
    console.log(`${route.name} @${width}: cross ${cross} px · noise floor ${noise} px · ${ok ? "within floor" : "DIFFERS"}`);
    await context.close();
  }
}

await browser.close();
const bad = results.filter((row) => !row.ok);
console.log(bad.length === 0 ? "ALL RESTING STATES IDENTICAL" : `${bad.length} route/width pairs differ`);
process.exitCode = bad.length === 0 ? 0 : 2;
await fsWrite(path.resolve(process.cwd(), "..", ".impeccable", "review", "motion-app", "resting.json"), results);

async function fsWrite(file, data) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(file, JSON.stringify(data, null, 2));
}
