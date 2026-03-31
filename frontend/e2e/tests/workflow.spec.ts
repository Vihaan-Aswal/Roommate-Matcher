import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const STUDENTS_CSV = path.join(REPO_ROOT, "demo-data", "master_students.csv");
const ROOMS_CSV = path.join(REPO_ROOT, "demo-data", "rooms.csv");
const FORM_RESPONSES_CSV = path.join(REPO_ROOT, "demo-data", "form_responses.csv");
const API_BASE = "http://127.0.0.1:8000";

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

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function parseCsv(filePath: string): Array<Record<string, string>> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

async function uploadCsv(
  page: Page,
  inputLabel: string,
  uploadButtonName: string,
  csvPath: string,
): Promise<void> {
  await page.getByLabel(inputLabel).setInputFiles(csvPath);
  await page.getByRole("button", { name: uploadButtonName }).click();
  await expect(page.getByText("Upload completed")).toBeVisible();
}

async function submitAllFormResponses(request: APIRequestContext): Promise<void> {
  const rows = parseCsv(FORM_RESPONSES_CSV);

  for (let index = 0; index < rows.length; index += 8) {
    const batch = rows.slice(index, index + 8);
    const responses = await Promise.all(
      batch.map((row) => {
        const payload: Record<string, string> = {
          admission_number: row.admission_number,
          dob: row.dob,
        };

        QUESTION_KEYS.forEach((key) => {
          payload[key] = row[key];
        });

        return request.post(`${API_BASE}/api/form/submit`, { data: payload });
      }),
    );

    for (const response of responses) {
      expect(response.ok()).toBeTruthy();
    }
  }
}

function studentRows(page: Page) {
  return page.locator('[data-testid^="student-row-"]');
}

test.describe.serial("primary admin and student workflow", () => {
  let runId = "";

  test.setTimeout(300_000);

  test("upload master students and rooms", async ({ page }) => {
    await page.goto("/admin/students-data");

    await uploadCsv(
      page,
      "Master Students CSV file input",
      "Upload Students",
      STUDENTS_CSV,
    );

    await uploadCsv(
      page,
      "Rooms CSV file input",
      "Upload Rooms",
      ROOMS_CSV,
    );

    await page.goto("/admin/matching-runs");
    await expect(page.getByText("M_1st_year_AC_2")).toBeVisible();
    await expect(page.getByText("F_1st_year_NonAC_3")).toBeVisible();
  });

  test("submit student form and verify admin collection updates", async ({ page }) => {
    await page.goto("/form");

    await page.getByLabel("Admission Number").fill("ADM0001");
    await page.getByLabel("Date of Birth").fill("2005-01-02");
    await page
      .getByRole("button", { name: "Continue to Questions" })
      .click();

    for (const key of QUESTION_KEYS) {
      await page.locator(`input[name="${key}"]`).first().check();
    }

    await page.getByRole("button", { name: "Submit Preferences" }).click();
    await expect(page.getByText("Thank you")).toBeVisible();

    await page.goto("/admin/form-collection");
    await expect(
      page.getByRole("row", {
        name: /M_1st_year_AC_2\s+24\s+1\s+4\.17%/,
      }),
    ).toBeVisible();
  });

  test("run matching and validate results, filters, details, and checker", async ({
    page,
    request,
  }) => {
    await submitAllFormResponses(request);

    await page.goto("/admin/matching-runs");
    await page
      .getByRole("button", { name: "Run All Ready Segments" })
      .click();

    await expect(
      page.getByText(/completed with status completed\./i),
    ).toBeVisible({ timeout: 120_000 });

    const runAlertText =
      (await page
        .getByText(/Run run_[^\s]+ completed with status completed\./i)
        .innerText()) ?? "";
    const runIdMatch = runAlertText.match(/run_[0-9]{14}_[a-f0-9]{8}/i);
    runId = runIdMatch ? runIdMatch[0] : "";
    expect(runId).toMatch(/^run_/);

    await page
      .getByRole("link", { name: "Student View" })
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: "Student Results", exact: true }),
    ).toBeVisible();
    await expect(studentRows(page).first()).toBeVisible();

    const labelSelect = page.locator("label:has-text('Label') select");

    await labelSelect.selectOption("Excellent");
    await expect(studentRows(page).first()).toBeVisible();
    expect(await studentRows(page).count()).toBeGreaterThan(0);

    await labelSelect.selectOption("Poor");
    await expect(studentRows(page).first()).toBeVisible();
    expect(await studentRows(page).count()).toBeGreaterThan(0);

    await labelSelect.selectOption("all");
    await page.getByLabel("At risk only").check();
    await expect(studentRows(page).first()).toBeVisible();
    expect(await studentRows(page).count()).toBeGreaterThan(0);

    await studentRows(page).first().click();
    await expect(page.getByText("Explanation reasons")).toBeVisible();
    await expect(page.getByText("Factor breakdown")).toBeVisible();

    const reasonItems = page.locator(
      "section:has-text('Explanation reasons') ul li",
    );
    expect(await reasonItems.count()).toBeGreaterThan(0);

    await page.goto("/admin/manual-checker");
    await page
      .locator("label:has-text('Segment') select")
      .selectOption("M_1st_year_AC_2");
    await page
      .getByRole("checkbox", { name: /ADM0001 - Demo A Student 001/ })
      .check();
    await page
      .locator("label:has-text('Candidate student') select")
      .selectOption("ADM0002");

    await page
      .getByRole("button", { name: /run compatibility report/i })
      .click();
    await expect(page.getByText("Group compatibility score")).toBeVisible();
  });

  test("export assignments CSV has expected header and row count", async ({
    page,
  }) => {
    test.skip(!runId, "Matching run ID was not captured from prior test.");

    await page.goto(
      `/admin/matching-runs/${runId}/rooms?segment=M_1st_year_AC_2&needsReview=0`,
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();

    expect(downloadedPath).not.toBeNull();
    const csvText = fs.readFileSync(downloadedPath as string, "utf-8").trim();
    const rows = csvText.split(/\r?\n/);

    expect(rows[0]).toBe(
      "room_id,segment_key,student_1,student_2,student_3,student_4,group_score",
    );
    expect(rows.length).toBe(13);
  });
});
