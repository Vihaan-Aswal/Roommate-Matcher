import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { resolvePythonRuntime } from "../../scripts/python-runtime.mjs";
import { demoToken, formToken, startDemo, waitForRunCompleted } from "../helpers";
import { API_BASE } from "../helpers";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
] as const;

async function runMatching(page: Page, workspaceId: string): Promise<string> {
  const token = await demoToken(page);
  const response = await page.request.post(`${API_BASE}/api/workspaces/${workspaceId}/matching/runs`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { scope: "all_ready_segments", segment_key: null },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { run_id: string };
  await waitForRunCompleted(page, workspaceId, body.run_id);
  return body.run_id;
}

async function createWorkspace(page: Page, name: string): Promise<string> {
  const token = await demoToken(page);
  const response = await page.request.post(`${API_BASE}/api/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

function adminFixture(): { token: string; tenantId: string; workspaceId: string } {
  const repoRoot = path.resolve(process.cwd(), "..");
  const python = resolvePythonRuntime(repoRoot);
  const output = execFileSync(
    python.command,
    [...python.prefixArgs, path.join(repoRoot, "backend", "scripts", "generate_e2e_admin_token.py")],
    { cwd: path.join(repoRoot, "backend"), encoding: "utf-8" },
  );
  const data = JSON.parse(output);
  return {
    token: data.token,
    tenantId: data.target_tenant_id,
    workspaceId: data.target_workspace_id,
  };
}

async function assertNoOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `${label} overflows horizontally at ${page.viewportSize()?.width}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("route sweep and guards", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  let workspaceId = "";
  let runId = "";
  let formLink = "";
  let admin: ReturnType<typeof adminFixture>;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    workspaceId = await startDemo(page);
    runId = await runMatching(page, workspaceId);
    formLink = `/f/${await formToken(page.request, workspaceId, await demoToken(page))}`;
    admin = adminFixture();
    await context.close();
  });

  test("public and authenticated routes render without overflow or console errors", async ({
    browser,
  }) => {
    const publicRoutes = [
      { path: "/", heading: /a room list you can sign/i },
      { path: "/login", heading: /open the desk/i },
      { path: formLink, heading: /roommate preferences/i },
    ];
    const appRouteTemplates = [
      { path: "/app", heading: /choose a workspace/i },
      { path: "/dashboard", heading: /^dashboard$/i },
      { path: "/students-data", heading: /students & data/i },
      { path: "/form-collection", heading: /form & collection/i },
      { path: "/matching-runs", heading: /matching runs/i },
      { path: "/matching-runs/RUN/rooms", heading: /room results/i },
      { path: "/matching-runs/RUN/students?segment=all", heading: /student results/i },
      { path: "/fairness", heading: /reports & fairness/i },
      { path: "/fairness/RUN", heading: /reports & fairness/i },
      { path: "/at-risk-review", heading: /at-risk review/i },
      { path: "/manual-checker", heading: /manual checker/i },
    ];

    for (const viewport of VIEWPORTS) {
      const anonContext = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const anonPage = await anonContext.newPage();
      for (const route of publicRoutes) {
        const errors: string[] = [];
        const onConsole = (message: { type: () => string; text: () => string }) => {
          if (message.type() === "error") errors.push(message.text());
        };
        anonPage.on("console", onConsole);

        await anonPage.goto(route.path);
        await expect(
          anonPage.getByRole("heading", { level: 1, name: route.heading }),
        ).toBeVisible({ timeout: 15_000 });
        await assertNoOverflow(anonPage, `${viewport.name}:${route.path}`);
        expect(
          errors,
          `${viewport.name}:${route.path} console errors:\n${errors.join("\n")}`,
        ).toEqual([]);
        anonPage.off("console", onConsole);
      }
      await anonContext.close();

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      const activeWorkspace = await startDemo(page);
      const activeRun = await runMatching(page, activeWorkspace);

      for (const template of appRouteTemplates) {
        const path = template.path
          .replace("RUN", activeRun)
          .replace(/^\/(?!app$)/, `/app/${activeWorkspace}/`);
        const errors: string[] = [];
        const onConsole = (message: { type: () => string; text: () => string }) => {
          if (message.type() === "error") errors.push(message.text());
        };
        page.on("console", onConsole);

        await page.goto(path);
        await expect(
          page.getByRole("heading", { level: 1, name: template.heading }),
        ).toBeVisible({ timeout: 15_000 });
        await assertNoOverflow(page, `${viewport.name}:${path}`);
        expect(errors, `${viewport.name}:${path} console errors:\n${errors.join("\n")}`).toEqual([]);
        page.off("console", onConsole);
      }

      await context.close();
    }
  });

  test("guards redirect unauthenticated users and non-admins", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/app/${workspaceId}/dashboard`);
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/platform");
    await expect(page).toHaveURL(/\/login$/);

    await startDemo(page);
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/admin/students-data");
    await expect(page).toHaveURL(/\/app$/);

    await context.close();
  });

  test("platform console routes render at both widths", async ({ browser }) => {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      await page.goto("/login");
      await page.evaluate((token) => sessionStorage.setItem("demo_token", token), admin.token);

      await page.goto("/platform");
      await expect(page.getByRole("heading", { name: "All tenants" })).toBeVisible();
      await assertNoOverflow(page, `${viewport.name}:/platform`);

      await page.goto(`/platform/tenants/${admin.tenantId}/workspaces`);
      await expect(page.getByRole("heading", { name: "Target Tenant" })).toBeVisible();
      await assertNoOverflow(page, `${viewport.name}:/platform/tenants/:id/workspaces`);

      await context.close();
    }
  });

  test("an empty workspace shows missing states, not crashes", async ({ page }) => {
    await startDemo(page);
    const emptyId = await createWorkspace(page, `Empty ${Date.now()}`);

    await page.goto(`/app/${emptyId}/dashboard`);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Missing").first()).toBeVisible();
    await expect(page.getByText(/No run recorded yet/i).first()).toBeVisible();

    await page.goto(`/app/${emptyId}/students-data`);
    await expect(page.getByText(/Master Students CSV/i).first()).toBeVisible();

    await page.goto(`/app/${emptyId}/matching-runs`);
    await expect(page.getByRole("heading", { name: "Matching Runs" })).toBeVisible();

    await page.goto(`/app/${emptyId}/fairness`);
    await expect(page.getByRole("heading", { name: /fairness/i }).first()).toBeVisible();

    await page.goto(`/app/${emptyId}/at-risk-review`);
    await expect(page.getByRole("heading", { name: /at-risk/i }).first()).toBeVisible();
  });

  test("the dashboard surfaces its loading and error states", async ({ page }) => {
    await startDemo(page);
    const token = await page.evaluate(() => sessionStorage.getItem("demo_token"));
    const created = await page.request.post("http://127.0.0.1:8000/api/workspaces", {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Error Probe ${Date.now()}` },
    });
    expect(created.ok()).toBeTruthy();
    const workspace = ((await created.json()) as { id: string }).id;

    let firstRequest = true;
    await page.route("**/api/workspaces/*/dashboard", async (route) => {
      if (firstRequest) {
        firstRequest = false;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "dashboard unavailable" }),
      });
    });

    await page.goto(`/app/${workspace}/dashboard`);
    await expect(page.getByText("Reading the workspace", { exact: true })).toBeVisible();
    await expect(page.getByText("The workspace could not be read")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("dashboard unavailable")).toBeVisible();
  });

  test("the at-risk rail reflects the review URL state", async ({ page }) => {
    await startDemo(page);
    await page.goto(
      `/app/${workspaceId}/matching-runs/${runId}/students?segment=all&label=all&atRisk=1`,
    );
    await expect(page.getByRole("link", { name: "At-Risk Review" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
