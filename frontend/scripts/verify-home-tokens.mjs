/**
 * verify-home-tokens.mjs — proof that promoting the motion tokens changes nothing.
 *
 * Dumps the computed `--m-*` values on `.mm-home` and captures the homepage at
 * 1280 with reduced motion (deterministic) for a pixel diff before/after.
 *
 *   node scripts/verify-home-tokens.mjs --out ../.impeccable/review/motion-app/tokens-before
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const base = arg("base", "http://127.0.0.1:5175");
const out = path.resolve(process.cwd(), arg("out", "../.impeccable/review/motion-app/tokens"));

const TOKENS = [
  "--m-ease-out",
  "--m-ease-in-out",
  "--m-dur-feedback",
  "--m-dur-change",
  "--m-dur-scene",
  "--m-dur-mark",
  "--m-dur-focal",
  "--m-stagger",
  "--m-stagger-cap",
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(600);

const styles = await page.evaluate((tokens) => {
  const node = document.querySelector(".mm-home");
  const root = document.documentElement;
  const computedHome = node ? getComputedStyle(node) : null;
  const computedRoot = getComputedStyle(root);
  const read = (style) =>
    style
      ? Object.fromEntries(tokens.map((token) => [token, style.getPropertyValue(token).trim()]))
      : null;
  return {
    home: read(computedHome),
    root: read(computedRoot),
    // resolved shorthand as well, so a change in cascade would show up even if the
    // raw custom property text stayed the same
    sample: node
      ? {
          transitionDuration: getComputedStyle(node).transitionDuration,
          animationDuration: getComputedStyle(node).animationDuration,
        }
      : null,
  };
}, TOKENS);

await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, "tokens.json"), JSON.stringify(styles, null, 2));
await page.screenshot({ path: path.join(out, "home-1280.png"), fullPage: true });

const full = await page.evaluate(() => ({
  height: document.documentElement.scrollHeight,
  width: document.documentElement.scrollWidth,
}));
await fs.writeFile(path.join(out, "page-size.json"), JSON.stringify(full, null, 2));

await browser.close();
console.log(JSON.stringify({ home: styles.home, root: styles.root, page: full }, null, 2));
