import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "@playwright/test";

import { demoToken, startDemo, waitForRunCompleted } from "../helpers";
import { API_BASE } from "../helpers";

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

async function expectAccessible(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" ")),
    })),
    `${label} has serious/critical axe violations`,
  ).toEqual([]);
}

test.describe("accessibility sweep", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test("eight core pages pass axe", async ({ browser }) => {
    const anonContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const anonPage = await anonContext.newPage();
    for (const entry of [
      { path: "/", label: "home" },
      { path: "/login", label: "login" },
    ]) {
      await anonPage.goto(entry.path);
      await anonPage.waitForLoadState("networkidle");
      await expectAccessible(anonPage, entry.label);
    }
    await anonContext.close();

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const activeWorkspace = await startDemo(page);
    const activeRun = await runMatching(page, activeWorkspace);

    const pages = [
      { path: `/app/${activeWorkspace}/dashboard`, label: "dashboard" },
      { path: `/app/${activeWorkspace}/students-data`, label: "students-data" },
      { path: `/app/${activeWorkspace}/matching-runs`, label: "matching-runs" },
      { path: `/app/${activeWorkspace}/matching-runs/${activeRun}/students?segment=all`, label: "student-results" },
      { path: `/app/${activeWorkspace}/fairness`, label: "fairness" },
      { path: `/app/${activeWorkspace}/manual-checker`, label: "manual-checker" },
    ];

    for (const entry of pages) {
      await page.goto(entry.path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page, entry.label);
    }

    await context.close();
  });

  test("keyboard order starts at skip link and focus is visible", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const activeWorkspace = await startDemo(page);
    await page.goto(`/app/${activeWorkspace}/dashboard`);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => ({
      text: document.activeElement?.textContent?.trim() ?? "",
      tag: document.activeElement?.tagName ?? "",
      outline: getComputedStyle(document.activeElement as Element).outlineStyle,
    }));
    expect(first.text).toMatch(/skip to the page/i);
    expect(first.tag).toBe("A");
    expect(first.outline).not.toBe("none");

    await page.keyboard.press("Tab");
    const second = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    expect(second.length).toBeGreaterThan(0);

    await context.close();
  });
});
