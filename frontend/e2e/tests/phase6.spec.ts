import { expect, test } from "@playwright/test";

import { runAllReadySegments, startDemo } from "../helpers";

test.describe.serial("Demo seeder and magic fill", () => {
  test.setTimeout(120_000);

  test("demo seed reaches a runnable dashboard", async ({ page }) => {
    await startDemo(page);

    await expect(page.getByText("96").first()).toBeVisible();
    await expect(page.getByText("4/4").first()).toBeVisible();
    await expect(page.getByText("100%").first()).toBeVisible();

    await page.getByRole("link", { name: "Matching Runs" }).first().click();
    await expect(page).toHaveURL(/\/app\/[a-f0-9-]+\/matching-runs/);

    const finishedRun = await runAllReadySegments(page);

    await finishedRun.row.getByRole("link", { name: "Rooms" }).click();
    await expect(page.getByRole("heading", { name: "Room Results", exact: true })).toBeVisible();

    const roomsUrl = page.url();
    await page.goto(roomsUrl.replace("/rooms", "/students") + "?segment=all");
    await expect(page.getByRole("heading", { name: "Student Results", exact: true })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });

  test("magic fill reports its result", async ({ page }) => {
    await startDemo(page);

    await page.getByText(/Magic Fill \(generated data\)/i).click();
    await page.getByRole("button", { name: /fill missing profiles/i }).click();
    await expect(page.getByText(/Magic Fill complete/i).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "Matching Runs" }).first().click();
    await runAllReadySegments(page);
  });
});
