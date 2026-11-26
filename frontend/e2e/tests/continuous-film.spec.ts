import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const AUTOPLAY_VIEWPORTS = [
  { name: "912x672", width: 912, height: 672 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "375x812", width: 375, height: 812 },
];

test.describe("continuous homepage film", () => {
  for (const viewport of AUTOPLAY_VIEWPORTS) {
    test(`autoplays from mount under reduced motion at ${viewport.name}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(String(error)));

      await page.goto("/?continuous=1");

      const pause = page.getByRole("button", {
        name: "Pause film",
        exact: true,
      });
      await expect(pause).toBeVisible();

      const timecode = page.locator(".cf-timecode");
      const scrub = page.locator(".cf-scrub");
      const before = {
        time: await timecode.innerText(),
        value: Number(await scrub.getAttribute("aria-valuenow")),
        scrollY: await page.evaluate(() => window.scrollY),
      };
      expect(before.scrollY).toBe(0);

      if (viewport.name === "912x672") {
        const stage = await page.evaluate(() => {
          const rect = document.querySelector(".cf-stage")?.getBoundingClientRect();
          if (!rect) return null;
          const visible = Math.max(
            0,
            Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
          );
          return {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height),
            viewportHeight: window.innerHeight,
            visibleFraction: Number((visible / rect.height).toFixed(3)),
          };
        });
        expect(stage).not.toBeNull();
        expect(stage!.visibleFraction).toBeLessThan(0.25);
        console.log(`912x672 stage: ${JSON.stringify(stage)}`);
      }

      await page.waitForTimeout(1600);

      const after = {
        time: await timecode.innerText(),
        value: Number(await scrub.getAttribute("aria-valuenow")),
        scrollY: await page.evaluate(() => window.scrollY),
      };
      expect(after.time).not.toBe(before.time);
      expect(after.value).toBeGreaterThan(before.value + 0.8);
      expect(after.scrollY).toBe(0);
      await expect(pause).toBeVisible();

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);

      console.log(
        `autoplay ${viewport.name}: time ${before.time} -> ${after.time}; ` +
          `slider ${before.value} -> ${after.value}; scrollY ${before.scrollY} -> ${after.scrollY}; button Pause`,
      );

      await context.close();
    });
  }

  test("pauses and replays at 1280x800", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/?continuous=1");

    await expect(
      page.getByRole("button", { name: "Pause film", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pause film", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Play film", exact: true }),
    ).toBeVisible();

    const timecode = page.locator(".cf-timecode");
    const paused = await timecode.innerText();
    await page.waitForTimeout(500);
    expect(await timecode.innerText()).toBe(paused);

    await page.getByRole("button", { name: "Replay film", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause film", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("96 responses. 38 rooms. One desk."),
    ).toBeVisible();

    await context.close();
  });

  test("has no serious accessibility violations", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/?continuous=1");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking.map((violation) => violation.id)).toEqual([]);

    await context.close();
  });
});
