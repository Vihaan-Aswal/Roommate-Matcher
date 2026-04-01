import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(repoRoot, "images");
const baseUrl = process.env.SHOWCASE_BASE_URL ?? "http://127.0.0.1:8000";

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function resolveRunAndSegment() {
  const runsResponse = await fetchJson(`${baseUrl}/api/matching/runs`);
  const completedRun = (runsResponse.runs ?? []).find(
    (run) => run.status === "completed",
  );
  if (!completedRun) {
    throw new Error(
      "No completed run found. Seed demo data and run matching first.",
    );
  }

  const segmentsResponse = await fetchJson(`${baseUrl}/api/segments`);
  const firstSegment = (segmentsResponse.segments ?? [])[0];
  if (!firstSegment) {
    throw new Error("No segments found. Seed demo data first.");
  }

  return {
    runId: completedRun.run_id,
    segmentKey: firstSegment.segment_key,
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const { runId, segmentKey } = await resolveRunAndSegment();
  const encodedRunId = encodeURIComponent(runId);
  const encodedSegment = encodeURIComponent(segmentKey);

  const targets = [
    {
      fileName: "dashboard.png",
      url: `${baseUrl}/admin/dashboard`,
      readyText: "Dashboard",
    },
    {
      fileName: "matching-results.png",
      url: `${baseUrl}/admin/matching-runs/${encodedRunId}/rooms?segment=${encodedSegment}&needsReview=0`,
      readyText: "Room Results",
    },
    {
      fileName: "student-results.png",
      url: `${baseUrl}/admin/matching-runs/${encodedRunId}/students?segment=all&label=all&atRisk=0`,
      readyText: "Student Results",
    },
    {
      fileName: "fairness-report.png",
      url: `${baseUrl}/admin/fairness/${encodedRunId}?segment=all`,
      readyText: "Reports & Fairness",
    },
    {
      fileName: "manual-checker.png",
      url: `${baseUrl}/admin/manual-checker?segment=${encodedSegment}`,
      readyText: "Manual Checker",
    },
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  for (const target of targets) {
    await page.goto(target.url, { waitUntil: "networkidle" });
    await page
      .getByText(target.readyText, { exact: true })
      .first()
      .waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);

    const outPath = path.join(outputDir, target.fileName);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`[screenshots] wrote ${outPath}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
