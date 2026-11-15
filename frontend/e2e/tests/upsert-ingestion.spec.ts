import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { demoToken, formToken, startDemo, submitResponse } from "../helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe("Upsert ingestion flow", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;
  let context: BrowserContext;
  let workspaceId: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await startDemo(page);
    await page.goto("/app");
    await page.getByRole("button", { name: /create new workspace/i }).click();
    await page.getByPlaceholder(/hostel office 2026/i).fill(`Ingestion Test ${Date.now()}`);
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page).toHaveURL(/\/app\/([^/]+)\/dashboard/);
    workspaceId = page.url().match(/\/app\/([^/]+)\/dashboard/)![1];
    await page.getByRole("link", { name: "Students & Data" }).click();
  });

  test.afterAll(async () => {
    await context.close();
  });

  async function uploadStudents(fileName: string): Promise<void> {
    await page.getByLabel("Master Students CSV file input").setInputFiles(path.join(__dirname, "../fixtures", fileName));
    await page.getByRole("button", { name: /Upload Students/i }).click();
    await expect(page.getByRole("heading", { name: "Students Upload Preview" })).toBeVisible();
  }

  async function expectDiff(adding: string, updating: string, removing: string, unchanged: string) {
    const preview = page.locator("section[aria-labelledby='diff-title']");
    await expect(preview.getByTestId("stat-adding").locator(".desk-figure-value")).toHaveText(adding);
    await expect(preview.getByTestId("stat-updating").locator(".desk-figure-value")).toHaveText(updating);
    await expect(preview.getByTestId("stat-removing").locator(".desk-figure-value")).toHaveText(removing);
    await expect(preview.getByTestId("stat-unchanged").locator(".desk-figure-value")).toHaveText(unchanged);
  }

  async function expectApplied(inserted: string, updated: string, removed: string, unchanged: string) {
    const stamp = page.locator(".m-stamp").filter({ hasText: "Students Applied Successfully" });
    await expect(stamp).toBeVisible();
    await expect(stamp.getByTestId("stat-inserted").locator(".desk-figure-value")).toHaveText(inserted);
    await expect(stamp.getByTestId("stat-updated").locator(".desk-figure-value")).toHaveText(updated);
    await expect(stamp.getByTestId("stat-removed").locator(".desk-figure-value")).toHaveText(removed);
    await expect(stamp.getByTestId("stat-unchanged").locator(".desk-figure-value")).toHaveText(unchanged);
  }

  test("initial upload previews and applies students and rooms", async () => {
    await uploadStudents("students_v1.csv");
    await expectDiff("4", "0", "0", "0");
    await page.getByRole("button", { name: /Confirm & Apply/i }).click();
    await expectApplied("4", "0", "0", "0");

    await page.getByLabel("Rooms CSV file input").setInputFiles(path.join(__dirname, "../fixtures/rooms_v1.csv"));
    await page.getByRole("button", { name: /Upload Rooms/i }).click();
    await expect(page.getByRole("heading", { name: "Rooms Upload Preview" })).toBeVisible();

    const stamp = page.locator(".m-stamp").filter({ hasText: "Rooms Applied Successfully" });
    await expect(page.getByTestId("stat-adding").last().locator(".desk-figure-value")).toHaveText("4");
    await page.getByRole("button", { name: /Confirm & Apply/i }).click();
    await expect(stamp).toBeVisible();
  });

  test("replacement upload preserves the historical form response", async ({ request }) => {
    const token = await demoToken(page);
    const publicToken = await formToken(request, workspaceId, token);
    await submitResponse(request, publicToken, "ADM003", "3212");

    await page.getByRole("button", { name: /upload another file/i }).first().click();
    await uploadStudents("students_v2.csv");
    await expectDiff("1", "1", "1", "2");
    await expect(page.getByText(/form response/i).first()).toBeVisible();

    await page.getByRole("button", { name: /Confirm & Apply/i }).click();
    await expectApplied("1", "1", "1", "2");
  });

  test("the same file is idempotent", async () => {
    await page.getByRole("button", { name: /upload another file/i }).first().click();
    await uploadStudents("students_v2.csv");
    await expectDiff("0", "0", "0", "4");

    await page.getByRole("button", { name: /Confirm & Apply/i }).click();
    await expectApplied("0", "0", "0", "4");
  });

  test("another tenant cannot preview this workspace", async ({ browser, request }) => {
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await startDemo(otherPage);
    const otherToken = await demoToken(otherPage);

    const response = await request.post(`http://127.0.0.1:8000/api/workspaces/${workspaceId}/students/upload/preview`, {
      headers: { Authorization: `Bearer ${otherToken}` },
      multipart: {
        file: {
          name: "test.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n1,Test,M,1st_year,AC,2,2000-01-01,1234",
          ),
        },
      },
    });

    expect([401, 403, 404]).toContain(response.status());
    await otherContext.close();
  });
});
