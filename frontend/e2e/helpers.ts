import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const API_BASE = "http://127.0.0.1:8000";

/** Open the seeded demo workspace from the login page and return its id. */
export async function startDemo(page: Page): Promise<string> {
  await page.goto("/login");
  await page.getByRole("button", { name: /open the demo workspace/i }).click();
  await expect(page).toHaveURL(/\/app\/[a-f0-9-]+\/dashboard/, { timeout: 60_000 });
  const match = page.url().match(/\/app\/([^/]+)\/dashboard/);
  if (!match) {
    throw new Error(`Demo login did not land on a dashboard: ${page.url()}`);
  }
  return match[1];
}

/** The app JWT stored by the demo login. */
export async function demoToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => sessionStorage.getItem("demo_token"));
  if (!token) {
    throw new Error("No demo_token in sessionStorage after demo login");
  }
  return token;
}

/** The active public form token for a workspace. */
export async function formToken(
  request: APIRequestContext,
  workspaceId: string,
  token: string,
): Promise<string> {
  const response = await request.get(`${API_BASE}/api/workspaces/${workspaceId}/form-link`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { token: string };
  return body.token;
}

/** One valid option per question, taken from the demo response fixture. */
export const VALID_ANSWERS: Record<string, string> = {
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
  q10_raw: "I prefer someone very similar to me",
};

/** Submit a public form response through the real API. */
export async function submitResponse(
  request: APIRequestContext,
  token: string,
  admissionNumber: string,
  phoneLast4: string,
  answers: Record<string, string> = VALID_ANSWERS,
): Promise<void> {
  const response = await request.post(`${API_BASE}/api/public/forms/${token}/submit`, {
    data: {
      submitted_admission_number: admissionNumber,
      submitted_phone_last4: phoneLast4,
      answers,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { valid?: boolean };
  expect(body.valid).toBe(true);
}

/**
 * Start a run over every ready segment and wait for its history row to finish.
 * The request returns while the run is queued, so the page polls until then.
 */
export async function runAllReadySegments(
  page: Page,
): Promise<{ runId: string; row: Locator }> {
  const existingRunIds = await page.locator("tbody .desk-mono").allInnerTexts();

  await page.getByRole("button", { name: /run all ready segments/i }).click();
  await expect(page.getByText(/Matching run (started|completed)/i)).toBeVisible({
    timeout: 120_000,
  });

  let runId = "";
  await expect
    .poll(
      async () => {
        const runIds = await page.locator("tbody .desk-mono").allInnerTexts();
        runId = runIds.find((id) => !existingRunIds.includes(id)) ?? "";
        return runId;
      },
      { timeout: 120_000 },
    )
    .not.toBe("");

  const row = page.locator("tbody tr", { hasText: runId }).first();
  await expect(row.locator('td[data-label="Status"]')).toHaveText(/completed/i, {
    timeout: 120_000,
  });
  return { runId, row };
}

/** Track browser console errors and fail the test if any occur. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export function expectNoConsoleErrors(errors: string[]): void {
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
}
