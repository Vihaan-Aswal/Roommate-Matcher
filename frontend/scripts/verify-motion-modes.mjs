/**
 * verify-motion-modes.mjs — the kill switch and reduced motion actually stop motion.
 *
 *   node scripts/verify-motion-modes.mjs --base http://127.0.0.1:5175
 */
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const base = arg("base", "http://127.0.0.1:5175");
const api = arg("api", process.env.CAPTURE_API_URL ?? "http://127.0.0.1:8000");

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
const url = `/app/${demo.workspace_id}/matching-runs/${encodeURIComponent(run.run_id)}/students?segment=all&label=all&atRisk=1`;

const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });

async function read(mode, media) {
  const context = await browser.newContext();
  await context.addInitScript(({ token }) => sessionStorage.setItem("demo_token", token), {
    token: demo.token,
  });
  if (mode) {
    await context.addInitScript(({ value }) => localStorage.setItem("mm-motion", value), {
      value: mode,
    });
  }
  const page = await context.newPage();
  if (media) await page.emulateMedia({ reducedMotion: media });
  await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const result = await page.evaluate(() => {
    const pick = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
        transform: style.transform,
        opacity: style.opacity,
      };
    };
    return {
      attribute: document.documentElement.dataset.motion,
      toast: pick(".desk-toast"),
      note: pick(".desk-note"),
      row: pick(".desk-table tbody tr"),
      button: pick(".desk-btn"),
      tick: (() => {
        const node = document.querySelector('.desk-nav-link[aria-current="page"]');
        if (!node) return null;
        const style = getComputedStyle(node, "::before");
        return { animationName: style.animationName, animationDuration: style.animationDuration };
      })(),
      skeleton: pick(".desk-skel"),
    };
  });
  await context.close();
  return result;
}

const full = await read(null, "no-preference");
const reduced = await read(null, "reduce");
const off = await read("off", "no-preference");
const calm = await read("reduced", "no-preference");

const checks = [
  ["attribute mirrors the mode (off)", off.attribute === "off"],
  ["attribute mirrors the mode (reduced)", calm.attribute === "reduced"],
  ["full: button has a transition", full.button?.transitionDuration !== "0s"],
  ["reduced (media): no animation", reduced.button?.animationName === "none" && reduced.note?.animationName === "none"],
  ["reduced (media): transitions are instant", parseFloat(reduced.button?.transitionDuration ?? "1") < 0.01],
  ["off (switch): no animation", off.button?.animationName === "none" && off.row?.animationName === "none"],
  ["off (switch): no transition", off.button?.transitionDuration === "0s"],
  ["calm (switch): no animation", calm.button?.animationName === "none"],
  ["full: the active tick draws in", full.tick?.animationName === "mmTickIn"],
];

let failures = 0;
for (const [label, pass] of checks) {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
}
console.log(JSON.stringify({ full, reduced, off, calm }, null, 2));
await browser.close();
process.exitCode = failures === 0 ? 0 : 2;
