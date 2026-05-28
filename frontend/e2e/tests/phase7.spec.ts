import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "path";
import { resolvePythonRuntime } from "../../scripts/python-runtime.mjs";

test.describe.serial("Phase 7 E2E Flow: Platform Console Impersonation", () => {
  let adminToken: string;
  let targetTenantId: string;
  let targetWorkspaceId: string;

  test.beforeAll(async () => {
    // Generate the platform admin token by calling our script
    const repoRoot = path.resolve(process.cwd(), "..");
    const python = resolvePythonRuntime(repoRoot);
    const backendDir = path.join(repoRoot, "backend");
    const scriptPath = path.join(backendDir, "scripts", "generate_e2e_admin_token.py");
    const output = execFileSync(python.command, [...python.prefixArgs, scriptPath], {
      cwd: backendDir,
      encoding: "utf-8",
    });
    const data = JSON.parse(output);
    adminToken = data.token;
    targetTenantId = data.target_tenant_id;
    targetWorkspaceId = data.target_workspace_id;
  });

  test("Platform Admin can impersonate a tenant and exit", async ({ page }) => {
    // Log any console errors during the test
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // 1. Visit login to initialize app state
    await page.goto("/login");

    // 2. Inject our platform admin token into sessionStorage
    await page.evaluate((token) => sessionStorage.setItem("demo_token", token), adminToken);

    // 3. Navigate to platform page
    await page.goto("/platform");

    // Step 12.1: Platform Admin Login -> should be at /platform
    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByRole("heading", { name: "Platform Console — All Tenants" })).toBeVisible();

    // Step 12.3: View Tenants
    // The home tenant is created by the setup, as well as the target tenant.
    // Ensure "Target Tenant" is in the table.
    await expect(page.getByText("Target Tenant")).toBeVisible();

    // Toggle demo tenants 
    const toggle = page.getByLabel(/Show Demo Tenants/i);
    await toggle.check();
    // Wait for demo tenant to appear (the global seed script seeds one)
    await expect(page.getByText("Demo Tenant", { exact: true })).toBeVisible();
    await toggle.uncheck();
    // Ensure demo tenant disappears
    await expect(page.getByText("Demo Tenant", { exact: true })).toBeHidden();

    // Step 12.4: Select Tenant
    // Find the row for Target Tenant and click its "Impersonate →" button
    const targetRow = page.locator("tr").filter({ hasText: "Target Tenant" });
    await targetRow.getByRole("button", { name: "Impersonate →" }).click();

    // Should navigate to workspaces page
    await expect(page).toHaveURL(new RegExp(`/platform/tenants/${targetTenantId}/workspaces`));
    await expect(page.getByRole("heading", { name: /Impersonate Target Tenant/ })).toBeVisible();
    await expect(page.getByText("Target Workspace")).toBeVisible();

    // Step 12.5: Enter Workspace
    // Click "Enter as this workspace"
    await page.getByRole("button", { name: "Enter as this workspace" }).click();

    // Wait for the navigation to the workspace dashboard
    await expect(page).toHaveURL(new RegExp(`/app/${targetWorkspaceId}/dashboard`));

    // Step 12.6: Verify Impersonation Banner
    const banner = page.getByRole("alert").filter({ hasText: "God Mode" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("God Mode");
    await expect(banner).toContainText(targetTenantId);

    // Click "Exit Impersonation"
    await banner.getByRole("button", { name: "Exit Impersonation" }).click();

    // Step 12.8: Exit Impersonation should restore and navigate back
    await expect(page).toHaveURL(/\/platform$/);
    await expect(banner).toBeHidden();
  });
});
