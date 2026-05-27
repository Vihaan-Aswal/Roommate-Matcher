import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe("Upsert Ingestion Flow E2E", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;
  let context: BrowserContext;
  let workspaceId: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  async function loginAndCreateWorkspace() {
    await page.goto("/login");
    await page.getByRole("button", { name: /launch demo/i }).click();
    await expect(page).toHaveURL(/.*\/app$/);
    
    await page.getByText(/Create New Workspace/i).click();
    const workspaceName = `Ingestion Test ${Date.now()}`;
    await page.getByPlaceholder(/workspace name/i).fill(workspaceName);
    await page.getByRole("button", { name: /^Create$/i }).click();
    
    await expect(page).toHaveURL(/.*\/app\/([^/]+)\/dashboard/);
    const url = page.url();
    const match = url.match(/\/app\/([^/]+)\/dashboard/);
    if (!match) throw new Error("Could not find workspace ID in URL");
    workspaceId = match[1];
  }

  async function expectStat(page: Page, label: string, value: string) {
    const testId = `stat-${label.toLowerCase().replace(/\s+/g, '-')}`;
    try {
      await expect(page.getByTestId(testId).locator('p').first()).toHaveText(value, { timeout: 3000 });
    } catch (e) {
      console.log(`Failed to find ${label} ${value}. Page HTML:`);
      console.log(await page.content());
      throw e;
    }
  }

  test("Step 10.2: Initial Upload (Students & Rooms)", async () => {
    await loginAndCreateWorkspace();
    
    // Navigate to Students & Data
    await page.getByText("Students & Data").click();
    await expect(page).toHaveURL(new RegExp(`/app/${workspaceId}/students-data`));

    // Upload students_v1.csv
    const studentsV1Path = path.join(__dirname, "../fixtures/students_v1.csv");
    await page.locator('div.space-y-4').filter({ hasText: 'Master Students CSV' }).locator('input[type="file"]').setInputFiles(studentsV1Path);
    await page.getByRole('button', { name: /Upload Students/i }).click();

    // Assert Diff Preview UI appears
    await expectStat(page, "Adding", "4");
    await expectStat(page, "Updating", "0");
    await expectStat(page, "Removing", "0");
    await expectStat(page, "Unchanged", "0");

    // Confirm & Apply
    await page.getByRole('button', { name: /Confirm & Apply/i }).click();
    
    // In DiffPreviewPanel.tsx it sets result to state and AdminStudentsData renders the Success view
    const successCard = page.locator('.bg-green-50\\/50', { hasText: 'Students Applied Successfully' });
    await expect(successCard).toBeVisible();
    await expect(successCard.locator('p', { hasText: '4' }).first()).toBeVisible();

    // Upload rooms_v1.csv
    const roomsV1Path = path.join(__dirname, "../fixtures/rooms_v1.csv");
    await page.locator('div.space-y-4').filter({ hasText: 'Rooms CSV' }).locator('input[type="file"]').setInputFiles(roomsV1Path);
    await page.getByRole('button', { name: /Upload Rooms/i }).click();

    // Assert Diff Preview UI appears for rooms
    await expectStat(page, "Adding", "4");
    await expectStat(page, "Updating", "0");
    await expectStat(page, "Removing", "0");
    await expectStat(page, "Unchanged", "0");

    await page.getByRole('button', { name: /Confirm & Apply/i }).click();
    const roomSuccessCard = page.locator('.bg-green-50\\/50', { hasText: 'Rooms Applied Successfully' });
    await expect(roomSuccessCard).toBeVisible();
    await expect(roomSuccessCard.locator('p', { hasText: '4' }).first()).toBeVisible();
  });

  test("Step 10.3 & 10.4: Replacement Upload & Historical Data Preservation", async ({ request }) => {
    // 1. Simulate historical data: insert a FormResponse for ADM003
    const response = await request.post(`http://127.0.0.1:8000/api/form/submit`, {
      data: {
        admission_number: "ADM003",
        dob: "2004-11-05",
        q1_raw: "Before 11 PM (early)",
        q2_raw: "Very tidy - I like things clean and organized",
        q3_raw: "Before 10 PM",
        q4a_raw: "Mainly for sleeping/studying, not for hanging out",
        q4b_raw: "Very uncomfortable",
        q5a_raw: "Almost never",
        q5b_raw: "Very uncomfortable",
        q6_raw: "I need a 100% smoke-free room",
        q7_raw: "I require an alcohol-free room",
        q8_raw: "I am strict vegetarian and require a meat-free room",
        q9_raw: "Budget-conscious - prefer to keep costs low",
        q10_raw: "I prefer someone very similar to me"
      }
    });
    expect(response.status()).toBe(200);

    // 2. Upload students_v2.csv
    const studentsV2Path = path.join(__dirname, "../fixtures/students_v2.csv");
    // We need to click "Upload Another File" or just select the input again
    // The previous test ended on the applied success screen.
    const uploadAnother = page.getByRole('button', { name: /Upload Another File/i });
    // There are two such buttons (students and rooms). We want the student one.
    // Let's scope it to the student section.
    const studentSection = page.locator('section').filter({ hasText: 'Student Data' });
    // Actually AdminStudentsData has two main div columns, not section.
    // The FileUploadPanel has title "Master Students CSV".
    
    // To reset, we click the "Upload Another File" in the student success card
    const studentSuccessCard = page.locator('.bg-green-50\\/50', { hasText: 'Students Applied Successfully' });
    await studentSuccessCard.getByRole('button', { name: /Upload Another File/i }).click();

    // Now FileUploadPanel is visible again
    const fileInput = page.locator('div.space-y-4').filter({ hasText: 'Master Students CSV' }).locator('input[type="file"]');
    await fileInput.setInputFiles(studentsV2Path);
    await page.getByRole('button', { name: /Upload Students/i }).click();

    // Assert Diff Preview panel correctly displays the exact stats
    await expectStat(page, "Adding", "1");
    await expectStat(page, "Updating", "1");
    await expectStat(page, "Removing", "1");
    await expectStat(page, "Unchanged", "2"); // V2 has 4 students. Wait, v1 had 4, v2 has 4.
    
    // Check for the warning about form responses being preserved
    // The UI should show warning from backend: "ADM003 has an active form response. Soft-deleting will preserve the form data..."
    await expect(page.getByText(/form response/i)).toBeVisible();

    // Confirm and apply
    await page.getByRole('button', { name: /Confirm & Apply/i }).click();
    const applySuccess = page.locator('.bg-green-50\\/50', { hasText: 'Students Applied Successfully' });
    await expect(applySuccess).toBeVisible();
    
    // Verify the stats in the applied card
    // The applied card has "Inserted", "Updated", "Removed", "Unchanged"
    // Let's use expectStat but scoped to successCard
    await expect(applySuccess.getByTestId('stat-inserted').locator('p')).toHaveText('1');
    await expect(applySuccess.getByTestId('stat-updated').locator('p')).toHaveText('1');
    await expect(applySuccess.getByTestId('stat-removed').locator('p')).toHaveText('1');
    await expect(applySuccess.getByTestId('stat-unchanged').locator('p')).toHaveText('2');
  });

  test("Step 10.5: Idempotency", async () => {
    // Reset back to upload selection
    const studentSuccessCard = page.locator('.bg-green-50\\/50', { hasText: 'Students Applied Successfully' });
    await studentSuccessCard.getByRole('button', { name: /Upload Another File/i }).click();

    // Upload students_v2.csv a second time
    const studentsV2Path = path.join(__dirname, "../fixtures/students_v2.csv");
    const fileInput = page.locator('div.space-y-4').filter({ hasText: 'Master Students CSV' }).locator('input[type="file"]');
    await fileInput.setInputFiles(studentsV2Path);
    await page.getByRole('button', { name: /Upload Students/i }).click();

    // Assert the UI shows 0 inserts, 0 updates, 0 removes, and 4 unchanged
    await expectStat(page, "Adding", "0");
    await expectStat(page, "Updating", "0");
    await expectStat(page, "Removing", "0");
    await expectStat(page, "Unchanged", "4");

    await page.getByRole('button', { name: /Confirm & Apply/i }).click();
    
    const applySuccess = page.locator('.bg-green-50\\/50', { hasText: 'Students Applied Successfully' });
    await expect(applySuccess).toBeVisible();
    
    await expect(applySuccess.getByTestId('stat-inserted').locator('p')).toHaveText('0');
    await expect(applySuccess.getByTestId('stat-updated').locator('p')).toHaveText('0');
    await expect(applySuccess.getByTestId('stat-removed').locator('p')).toHaveText('0');
    await expect(applySuccess.getByTestId('stat-unchanged').locator('p')).toHaveText('4');
  });

  test("Step 10.6: Tenant Isolation", async ({ browser }) => {
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    
    await otherPage.goto("/login");
    await otherPage.getByRole("button", { name: /launch demo/i }).click();
    await expect(otherPage).toHaveURL(/.*\/app$/);
    
    const otherReqContext = otherContext.request;
    const response = await otherReqContext.post(`http://127.0.0.1:8000/api/workspaces/${workspaceId}/students/upload/preview`, {
      multipart: {
        file: {
          name: "test.csv",
          mimeType: "text/csv",
          buffer: Buffer.from("admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n1,Test,M,1st_year,AC,2,2000-01-01,1234")
        }
      }
    });

    expect([401, 403, 404]).toContain(response.status());
    
    await otherContext.close();
  });
});
