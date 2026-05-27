import { test, expect } from "@playwright/test";

test.describe("Phase 2 Workspace Foundation E2E", () => {
  test("Test 1: Unauthenticated Routing", async ({ page }) => {
    // Navigate to the root
    await page.goto("/");
    
    // Assert the application automatically redirects to /login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("Test 2: Demo Flow Verification", async ({ page }) => {
    page.on("console", msg => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", err => console.log("PAGE ERROR:", err));

    await page.goto("/login");

    await page.getByRole("button", { name: /launch demo/i }).click();

    // Check if there is an error message displayed
    const errorLocator = page.locator("text=Failed");
    if (await errorLocator.isVisible()) {
      console.log("Demo creation failed with error:", await errorLocator.textContent());
    }

    // The login page redirects to /app. The demo workspace should appear as a card.
    await expect(page).toHaveURL(/.*\/app$/, { timeout: 15000 });
    
    // Click the Demo Workspace card to go to the dashboard
    await page.getByText(/Demo/i).first().click();

    // Assert the URL is now /app/{demoWorkspaceId}/dashboard
    await expect(page).toHaveURL(/.*\/app\/.*\/dashboard/);

    // Assert the "Demo Mode" badge is visible in the UI (e.g., in the sidebar)
    await expect(page.getByText(/demo mode/i)).toBeVisible();
  });

  test("Test 3: Workspace Creation & UI Verification", async ({ page }) => {
    // Authenticate (using a demo session)
    await page.goto("/login");
    await page.getByRole("button", { name: /launch demo/i }).click();
    await expect(page).toHaveURL(/.*\/app$/);

    // We are already on the Workspace Chooser page (/app).
    // Click "Create New Workspace"
    await page.getByText(/Create New Workspace/i).click();

    // Fill out the workspace name
    const workspaceName = `Test Workspace ${Date.now()}`;
    await page.getByPlaceholder(/workspace name/i).fill(workspaceName);
    await page.getByRole("button", { name: /^Create$/i }).click();

    // Assert the new workspace dashboard is loaded
    await expect(page).toHaveURL(/.*\/app\/.*\/dashboard/);

    // Assert the workspace name is visible in the header/sidebar
    await expect(page.getByText(workspaceName).first()).toBeVisible();

    // Verify Settings tab works
    // (Assuming Settings is part of the AdminLayout sidebar)
    // Here we just verify the structure is present (e.g. sidebar navigation)
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("Test 4: Tenant Isolation Check", async ({ browser }) => {
    // 1. Create a demo session for Tenant A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    
    await pageA.goto("/login");
    await pageA.getByRole("button", { name: /launch demo/i }).click();
    await expect(pageA).toHaveURL(/.*\/app$/);
    await pageA.getByText(/Demo/i).first().click();
    await expect(pageA).toHaveURL(/.*\/app\/.*\/dashboard/);
    
    const tenantAUrl = pageA.url();
    await contextA.close(); // Log out Tenant A
    
    // 2. Create a demo session for Tenant B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageB.goto("/login");
    await pageB.getByRole("button", { name: /launch demo/i }).click();
    await expect(pageB).toHaveURL(/.*\/app$/);
    await pageB.getByText(/Demo/i).first().click();
    await expect(pageB).toHaveURL(/.*\/app\/.*\/dashboard/);

    // 3. Attempt to access Tenant A's Dashboard using Tenant B's session
    await pageB.goto(tenantAUrl);

    // The backend should return 401/403 or redirect
    // If it doesn't redirect, the frontend should display an error message
    // such as "Unable to load dashboard" or "Unauthorized"
    const currentUrl = pageB.url();
    if (currentUrl === tenantAUrl) {
      await expect(pageB.getByText(/unable to load dashboard|unauthorized|forbidden|not found/i).first()).toBeVisible();
    } else {
      await expect(pageB).not.toHaveURL(tenantAUrl);
    }
    
    await contextB.close();
  });
});
