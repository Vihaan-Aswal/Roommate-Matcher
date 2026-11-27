/**
 * diff-screenshots.mjs — pixel comparison without adding dependencies.
 *
 * Decodes two PNGs in a headless browser canvas and reports how many pixels
 * differ. Used to prove the frozen homepage did not move.
 *
 *   node scripts/diff-screenshots.mjs <dirA> <baseA> <dirB> <baseB> [widths...]
 */
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const [dirA, baseA, dirB, baseB, ...widths] = process.argv.slice(2);
if (!dirA || !baseA || !dirB || !baseB) {
  console.error("usage: node scripts/diff-screenshots.mjs <dirA> <baseA> <dirB> <baseB> [widths...]");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function toDataUrl(file) {
  const bytes = await fs.readFile(file);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

const results = [];
for (const width of widths.length ? widths : ["375", "768", "1280", "1920"]) {
  const a = path.resolve(process.cwd(), dirA, `${baseA}-${width}.png`);
  const b = path.resolve(process.cwd(), dirB, `${baseB}-${width}.png`);
  const urlA = await toDataUrl(a);
  const urlB = await toDataUrl(b);

  await page.setContent("<canvas id=c></canvas>");
  const diff = await page.evaluate(
    async ({ urlA, urlB }) => {
      const load = (src) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = src;
        });
      const [imgA, imgB] = await Promise.all([load(urlA), load(urlB)]);
      if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
        return { sizeMismatch: `${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}` };
      }
      const canvas = document.getElementById("c");
      canvas.width = imgA.width;
      canvas.height = imgA.height;
      const context = canvas.getContext("2d");
      context.drawImage(imgA, 0, 0);
      const dataA = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(imgB, 0, 0);
      const dataB = context.getImageData(0, 0, canvas.width, canvas.height).data;

      let differing = 0;
      let maxDelta = 0;
      for (let i = 0; i < dataA.length; i += 4) {
        const delta =
          Math.abs(dataA[i] - dataB[i]) +
          Math.abs(dataA[i + 1] - dataB[i + 1]) +
          Math.abs(dataA[i + 2] - dataB[i + 2]);
        if (delta > 0) differing += 1;
        if (delta > maxDelta) maxDelta = delta;
      }
      return {
        width: imgA.width,
        height: imgA.height,
        pixels: dataA.length / 4,
        differing,
        maxDelta,
      };
    },
    { urlA, urlB },
  );
  results.push({ width, ...diff });
  console.log(JSON.stringify({ width, ...diff }));
}

await browser.close();
const failed = results.filter((row) => row.sizeMismatch || row.differing > 0);
console.log(failed.length === 0 ? "IDENTICAL" : `DIFFERENT: ${failed.length} width(s) differ`);
process.exitCode = failed.length === 0 ? 0 : 2;
