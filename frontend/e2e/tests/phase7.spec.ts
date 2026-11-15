import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { resolvePythonRuntime } from "../../scripts/python-runtime.mjs";

test.describe.serial("Platform console impersonation", () => {
  let adminToken: string;
  let targetTenantId: string;
  let targetWorkspaceId: string;

  test.beforeAll(async () => {
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

  test("platform admin can enter and leave a tenant workspace", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/login");
    await page.evaluate((token) => sessionStorage.setItem("demo_token", token), adminToken);
    await page.goto("/platform");

    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByRole("heading", { name: "All tenants" })).toBeVisible();
    await expect(page.getByText("Target Tenant")).toBeVisible();

    const toggle = page.getByLabel(/include demo tenants/i);
    await toggle.check();
    await expect(page.getByText("Demo Tenant", { exact: true })).toBeVisible();
    await toggle.uncheck();
    await expect(page.getByText("Demo Tenant", { exact: true })).toBeHidden();

    const targetRow = page.locator("tr").filter({ hasText: "Target Tenant" });
    await targetRow.getByRole("button", { name: "Workspaces" }).click();

    await expect(page).toHaveURL(new RegExp(`/platform/tenants/${targetTenantId}/workspaces`));
    await expect(page.getByRole("heading", { name: "Target Tenant" })).toBeVisible();
    await expect(page.getByText("Target Workspace")).toBeVisible();

    await page.getByRole("button", { name: "Enter as this workspace" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/${targetWorkspaceId}/dashboard`));

    const banner = page.getByRole("alert").filter({ hasText: /you are inside tenant/i });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(targetTenantId);

    await banner.getByRole("button", { name: /exit impersonation/i }).click();
    await expect(page).toHaveURL(/\/platform$/);
    await expect(banner).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });
});
