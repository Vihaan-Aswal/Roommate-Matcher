import { expect, test } from "@playwright/test";

import { startDemo } from "../helpers";

test.describe("Workspace foundation", () => {
  test("the homepage is public and /app is guarded", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /a room list you can sign/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("demo flow lands on a seeded dashboard", async ({ page }) => {
    const workspaceId = await startDemo(page);
    expect(workspaceId).toMatch(/^[a-f0-9-]+$/);

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("96").first()).toBeVisible();
    await expect(page.getByText("4/4").first()).toBeVisible();
    await expect(page.getByText(/demo/i).first()).toBeVisible();
  });

  test("a workspace can be created from the chooser", async ({ page }) => {
    await startDemo(page);
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Choose a workspace" })).toBeVisible();

    await page.getByRole("button", { name: /create new workspace/i }).click();
    const workspaceName = `Test Workspace ${Date.now()}`;
    await page.getByPlaceholder(/hostel office 2026/i).fill(workspaceName);
    await page.getByRole("button", { name: /^create$/i }).click();

    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/);
    await expect(page.getByText(workspaceName).first()).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("one tenant's token cannot read another tenant's workspace", async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const workspaceA = await startDemo(pageA);
    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await startDemo(pageB);

    await pageB.goto(`/app/${workspaceA}/dashboard`);
    const error = pageB.getByText(
      /could not be read|access denied|unauthorized|forbidden|not found/i,
    );
    if (pageB.url().includes(workspaceA)) {
      await expect(error.first()).toBeVisible();
    } else {
      await expect(pageB).not.toHaveURL(new RegExp(workspaceA));
    }

    await contextB.close();
  });
});
