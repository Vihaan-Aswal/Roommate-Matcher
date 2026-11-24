import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { runAllReadySegments, startDemo } from "../helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const STUDENTS_CSV = path.join(REPO_ROOT, "demo-data", "master_students.csv");
const ROOMS_CSV = path.join(REPO_ROOT, "demo-data", "rooms.csv");

const QUESTION_KEYS = [
  "q1_raw",
  "q2_raw",
  "q3_raw",
  "q4a_raw",
  "q4b_raw",
  "q5a_raw",
  "q5b_raw",
  "q6_raw",
  "q7_raw",
  "q8_raw",
  "q9_raw",
  "q10_raw",
] as const;

async function uploadCsv(
  page: Page,
  inputLabel: string,
  uploadButtonName: string,
  csvPath: string,
  previewTitle: string,
  appliedTitle: string,
): Promise<void> {
  await page.getByLabel(inputLabel).setInputFiles(csvPath);
  await page.getByRole("button", { name: uploadButtonName }).click();
  await expect(page.getByRole("heading", { name: previewTitle })).toBeVisible();
  await page.getByRole("button", { name: "Confirm & Apply" }).click();
  await expect(page.getByRole("heading", { name: appliedTitle })).toBeVisible();
}

test.describe.serial("primary admin and student workflow", () => {
  let context: BrowserContext;
  let page: Page;
  let workspaceId = "";
  let runId = "";

  test.setTimeout(300_000);

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    workspaceId = await startDemo(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("upload master students and rooms through the diff preview", async () => {
    await page.goto(`/app/${workspaceId}/students-data`);

    await uploadCsv(
      page,
      "Master Students CSV file input",
      "Upload Students",
      STUDENTS_CSV,
      "Students Upload Preview",
      "Students Applied Successfully",
    );

    await uploadCsv(
      page,
      "Rooms CSV file input",
      "Upload Rooms",
      ROOMS_CSV,
      "Rooms Upload Preview",
      "Rooms Applied Successfully",
    );
  });

  test("student form submits through the public link", async ({ request }) => {
    const token = await page.evaluate(() => sessionStorage.getItem("demo_token"));
    expect(token).toBeTruthy();

    const linkResponse = await request.get(`http://127.0.0.1:8000/api/workspaces/${workspaceId}/form-link`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(linkResponse.ok()).toBeTruthy();
    const { token: publicToken } = (await linkResponse.json()) as { token: string };

    await page.goto(`/f/${publicToken}`);
    await page.getByLabel("Admission Number").fill("ADM0001");
    await page.getByLabel("Last 4 digits of Phone Number").fill("4567");
    await page.getByRole("button", { name: "Continue to Questions" }).click();

    for (const key of QUESTION_KEYS) {
      await page.locator(`input[name="${key}"]`).first().check();
    }
    await page.getByRole("button", { name: "Submit Preferences" }).click();
    await expect(page.getByRole("heading", { name: "Response recorded." })).toBeVisible();
  });

  test("run matching, read results, use the checker", async () => {
    await page.goto(`/app/${workspaceId}/matching-runs`);
    const finishedRun = await runAllReadySegments(page);
    runId = finishedRun.runId;
    await expect(finishedRun.row.getByRole("link", { name: "Rooms" })).toBeVisible();

    await page.goto(`/app/${workspaceId}/matching-runs/${runId}/students?segment=all`);
    await expect(page.getByRole("heading", { name: "Student Results", exact: true })).toBeVisible();
    const rows = page.locator('[data-testid^="student-row-"]');
    await expect(rows.first()).toBeVisible();

    await page.getByRole("button", { name: "Poor", exact: true }).click();
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("checkbox", { name: /at risk only/i }).click();
    await expect(page.getByRole("checkbox", { name: /at risk only/i })).toHaveAttribute("aria-checked", "true");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    await rows.first().click();
    await expect(page.getByText("Explanation reasons")).toBeVisible();
    await expect(page.getByText("Factor breakdown")).toBeVisible();
    expect(await page.locator("section:has-text('Explanation reasons') ul li").count()).toBeGreaterThan(0);

    await page.goto(`/app/${workspaceId}/manual-checker`);
    await expect(page.getByRole("heading", { name: "Build the group" })).toBeVisible();
    const roomSizeNote = await page.getByText(/\d+-bed room/).innerText();
    const roomSize = Number(roomSizeNote.match(/(\d+)-bed/)?.[1] ?? "2");

    const existing = page.locator(".desk-check input[type=checkbox]");
    for (let index = 0; index < roomSize - 1; index += 1) {
      await existing.nth(index).check();
    }

    await page.getByRole("combobox").last().click();
    await page.getByRole("option").filter({ hasNotText: "Select candidate" }).first().click();
    await page.getByRole("button", { name: /run compatibility report/i }).click();
    await expect(page.getByText("Group compatibility score")).toBeVisible({ timeout: 60_000 });
  });

  test("export assignments CSV has the documented header", async () => {
    await page.goto(`/app/${workspaceId}/matching-runs/${runId}/rooms`);
    await expect(page.getByRole("heading", { name: "Room Results", exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();

    const csvText = fs.readFileSync(downloadedPath as string, "utf-8").trim();
    const rows = csvText.split(/\r?\n/);
    expect(rows[0]).toBe("room_id,segment_key,student_1,student_2,student_3,student_4,group_score");
    expect(rows.length).toBeGreaterThan(1);
  });
});
