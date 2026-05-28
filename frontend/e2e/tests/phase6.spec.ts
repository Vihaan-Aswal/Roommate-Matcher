import { expect, test } from "@playwright/test";

test.describe.serial("Phase 6 E2E Flow: Demo Seeder & Magic Fill", () => {
  test.setTimeout(60_000); // 60 seconds STRICT ENFORCEMENT

  test("Gate Check: login -> demo -> run matching in under 60s", async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

    // 1. Navigate to login page
    await page.goto("/login");

    // 2. Click "Launch Demo"
    await page.getByRole("button", { name: /launch demo/i }).click();

    // 3. Wait for redirect to workspace dashboard (should happen within 5-10s)
    await expect(page).toHaveURL(/\/app\/[a-f0-9-]+\/dashboard/, { timeout: 10_000 });

    // 4. Verify Dashboard shows fully seeded data
    // The demo seeds 96 students, 38 rooms, and 100% form completion.
    await expect(page.getByText("96").first()).toBeVisible();
    await expect(page.getByText("4/4").first()).toBeVisible();
    await expect(page.getByText("100%").first()).toBeVisible();

    // 5. Navigate to Matching Runs page
    await page.getByRole("link", { name: "Run Matching" }).first().click();
    await expect(page).toHaveURL(/\/app\/[a-f0-9-]+\/matching-runs/);

    // 6. Click "Run All Ready Segments"
    await page.getByRole("button", { name: /run all ready segments/i }).click();

    // 7. Wait for results to appear
    await expect(page.getByText(/completed with status completed\./i)).toBeVisible({ timeout: 25_000 });

    // 8. Verify we can go to Student View and see results
    await page.getByRole("link", { name: /student view/i }).first().click();
    await expect(page.getByRole("heading", { name: "Student Results", exact: true })).toBeVisible();
    
    // We should see a table of student assignments
    await expect(page.locator('table')).toBeVisible();
  });

  test("Flow B: Magic Fill -> Run Match", async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // 1. Navigate to login page
    await page.goto("/login");

    // 2. Click "Launch Demo" to get a workspace
    await page.getByRole("button", { name: /launch demo/i }).click();

    // 3. Wait for redirect
    await expect(page).toHaveURL(/\/app\/[a-f0-9-]+\/dashboard/, { timeout: 10_000 });

    // 4. Click Magic Fill button
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole("button", { name: /⚡ Magic Fill Missing/i }).click();

    // 5. Navigate to Matching Runs page
    await page.getByRole("link", { name: "Run Matching" }).first().click();
    await expect(page).toHaveURL(/\/app\/[a-f0-9-]+\/matching-runs/);

    // 6. Click "Run All Ready Segments"
    await page.getByRole("button", { name: /run all ready segments/i }).click();

    // 7. Wait for results to appear
    await expect(page.getByText(/completed with status completed\./i)).toBeVisible({ timeout: 25_000 });
  });
});
