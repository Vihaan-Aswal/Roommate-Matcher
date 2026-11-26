import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "tablet-912", width: 912, height: 672 },
  { name: "mobile-375", width: 375, height: 812 },
] as const;

async function setPipelineTime(page: Page, time: number): Promise<void> {
  await page.evaluate((value) => {
    const input = document.querySelector(".cp-scrub") as HTMLInputElement | null;
    if (!input) throw new Error("No pipeline slider");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, time);
  await expect(page.locator(".cp-timecode")).toContainText(
    `00:${time.toFixed(1).padStart(4, "0")}`,
  );
}

async function expectFullyInside(
  child: Locator,
  parent: Locator,
  label: string,
): Promise<void> {
  const childBox = await child.boundingBox();
  const parentBox = await parent.boundingBox();
  expect(childBox, `${label} has no box`).not.toBeNull();
  expect(parentBox, `${label} container has no box`).not.toBeNull();
  expect(childBox!.x, `${label} clips left`).toBeGreaterThanOrEqual(parentBox!.x - 0.75);
  expect(childBox!.y, `${label} clips top`).toBeGreaterThanOrEqual(parentBox!.y - 0.75);
  expect(childBox!.x + childBox!.width, `${label} clips right`).toBeLessThanOrEqual(
    parentBox!.x + parentBox!.width + 0.75,
  );
  expect(childBox!.y + childBox!.height, `${label} clips bottom`).toBeLessThanOrEqual(
    parentBox!.y + parentBox!.height + 0.75,
  );
}

async function noHorizontalOverflow(page: Page, label: string): Promise<void> {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth, `${label} overflows horizontally`).toBeLessThanOrEqual(
    sizes.clientWidth + 1,
  );
}

test("the classic film stays the default at /", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("group", { name: /sample run film/i })).toBeVisible();
  await expect(page.getByRole("group", { name: /cohort pipeline animation/i })).toHaveCount(0);
});

for (const viewport of VIEWPORTS) {
  test.describe(`cohort pipeline at ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });

    test("runs on mount, keeps every number framed and supports review controls", async ({
      page,
    }) => {
      const apiCalls: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/")) apiCalls.push(request.url());
      });

      await page.goto("/?pipeline=1");
      await page.evaluate(() => document.fonts.ready);

      const stage = page.locator(".cp-stage");
      const film = page.locator(".cp-film");
      await expect(stage).toBeVisible();
      await expect(stage).toHaveAttribute("data-playing", "true");
      await expect(page.getByRole("button", { name: "Pause pipeline" })).toBeVisible();

      // Autoplay is not gated on intersection, even when this viewport puts
      // most of the hero stage below the fold.
      await page.waitForTimeout(1300);
      const liveTime = await page.locator(".cp-timecode").innerText();
      expect(liveTime).not.toBe("00:00.0 / 00:10");

      await page.getByRole("button", { name: "Pause pipeline" }).click();
      await expect(stage).toHaveAttribute("data-playing", "false");
      await noHorizontalOverflow(page, viewport.name);

      await setPipelineTime(page, 2);
      await expect(page.getByText("A roster, a room list, a private form.")).toBeVisible();
      await expectFullyInside(stage.locator(".cp-stat-row strong").first(), stage, "roster 96");
      await expectFullyInside(stage.locator(".cp-stat-row strong").nth(1), stage, "rooms 38");
      await expectFullyInside(stage.getByText("12", { exact: true }), stage, "form 12");

      await setPipelineTime(page, 3.5);
      await expect(
        page.getByText("Students answer once. Raw answers stay sealed."),
      ).toBeVisible();
      await expect(stage.getByText("Sealed", { exact: true })).toBeVisible();

      await setPipelineTime(page, 5);
      await expect(
        stage.locator(".cp-normalised").getByText("Normalised preferences", { exact: false }),
      ).toBeVisible();
      await expect(
        stage.locator(".cp-normalised").getByText("Lifestyle tolerance", { exact: true }),
      ).toBeVisible();

      await setPipelineTime(page, 7);
      await expect(stage.getByText("M · 1st · AC", { exact: true })).toBeVisible();
      await expect(stage.getByText("F · 2nd–4th · Non-AC", { exact: true })).toBeVisible();

      await setPipelineTime(page, 8.5);
      await expect(
        page.getByText("Four boundaries decide who can be compared."),
      ).toBeVisible();
      for (const number of ["4,560", "3,456", "1,104"]) {
        await expectFullyInside(stage.getByText(number, { exact: true }), stage, number);
      }
      await expect(stage.getByText("Open · R-12", { exact: true })).toBeVisible();
      await expect(
        stage.locator(".cp-open-slip").getByText("S-009 × S-021", { exact: true }),
      ).toBeVisible();

      await setPipelineTime(page, 9.5);
      await expect(
        page.getByText("Every eligible pair is scored on ten weighted factors."),
      ).toBeVisible();
      const score = stage.getByText("0.416", { exact: true });
      await expectFullyInside(score, stage, "pair score");
      const scoreSize = await score.evaluate(
        (node) => Number.parseFloat(getComputedStyle(node).fontSize),
      );
      expect(scoreSize, "pair score is large enough to read").toBeGreaterThanOrEqual(44);

      const factorNames = stage.locator(".cp-factor-name");
      await expect(factorNames).toHaveCount(10);
      const factorCount = await factorNames.count();
      for (let index = 0; index < factorCount; index += 1) {
        const factor = factorNames.nth(index);
        await expectFullyInside(factor, stage.locator(".cp-score-sheet"), `factor ${index}`);
        const size = await factor.evaluate(
          (node) => Number.parseFloat(getComputedStyle(node).fontSize),
        );
        expect(size, `factor ${index} is not tiny`).toBeGreaterThanOrEqual(10);
      }

      await setPipelineTime(page, 10);
      await expect(page.getByText("End of take")).toBeVisible();
      await expect(page.getByRole("button", { name: "Replay pipeline" })).toBeVisible();

      // Replay returns to the first frame and starts again.
      await page.getByRole("button", { name: "Replay pipeline", exact: true }).click();
      await expect(stage).toHaveAttribute("data-playing", "true");
      await expect(page.getByText("A roster, a room list, a private form.")).toBeVisible();

      // Stage keyboard: Space pauses, the slider takes arrow keys.
      await stage.focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("button", { name: "Play pipeline", exact: true })).toBeVisible();
      await page.locator(".cp-scrub").focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(".cp-timecode")).not.toContainText("00:00.0");

      // The moving stage is decorative; the caption is live text.
      await expect(stage.locator(".cp-world")).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator(".cp-caption")).toHaveAttribute("aria-live", "polite");
      await expect(film).toBeVisible();

      expect(apiCalls, `homepage called the API: ${apiCalls.join(", ")}`).toEqual([]);
    });
  });
}
