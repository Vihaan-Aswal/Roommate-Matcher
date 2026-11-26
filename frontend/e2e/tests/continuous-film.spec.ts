import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "1280", width: 1280, height: 900 },
  { name: "375", width: 375, height: 900 },
];

test.describe("continuous homepage film", () => {
  for (const viewport of VIEWPORTS) {
    test(`runs, pauses and stays in frame at ${viewport.name}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(String(error)));

      await page.goto("/?continuous=1");
      const film = page.getByRole("group", {
        name: "Continuous sample run film",
      });
      await film.scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "Pause film", exact: true })).toBeVisible();

      const timecode = page.locator(".cf-timecode");
      const before = await timecode.innerText();
      await page.waitForTimeout(900);
      const after = await timecode.innerText();
      expect(after).not.toBe(before);

      await page.getByRole("button", { name: "Pause film", exact: true }).click();
      await expect(page.getByRole("button", { name: "Play film", exact: true })).toBeVisible();
      const paused = await timecode.innerText();
      await page.waitForTimeout(500);
      expect(await timecode.innerText()).toBe(paused);

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);

      await context.close();
    });
  }

  test("has no serious accessibility violations", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/?continuous=1");
    await page
      .getByRole("group", { name: "Continuous sample run film" })
      .scrollIntoViewIfNeeded();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      blocking.map((violation) => violation.id),
    ).toEqual([]);
    await context.close();
  });

  test("keeps moving when reduced motion is requested", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/?continuous=1");
    await page
      .getByRole("group", { name: "Continuous sample run film" })
      .scrollIntoViewIfNeeded();

    await expect(page.getByRole("button", { name: "Pause film", exact: true })).toBeVisible();
    const timecode = page.locator(".cf-timecode");
    const before = await timecode.innerText();
    await page.waitForTimeout(900);
    expect(await timecode.innerText()).not.toBe(before);
    await expect(page.getByRole("button", { name: "Pause film", exact: true })).toBeVisible();
    await expect(page.getByText("End of take")).toHaveCount(0);

    await context.close();
  });
});
