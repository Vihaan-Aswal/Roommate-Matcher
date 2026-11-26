import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "tablet-912", width: 912, height: 672 },
  { name: "mobile-375", width: 375, height: 812 },
] as const;

const STATIONS = [
  { name: "inputs", time: 2.5, caption: "A roster, a room list, a private form." },
  {
    name: "form",
    time: 7.5,
    caption: "Students answer once. Raw answers stay sealed.",
  },
  {
    name: "boundaries",
    time: 13,
    caption: "Four boundaries decide who can be compared.",
  },
  {
    name: "score",
    time: 19,
    caption: "Every eligible pair is scored on ten weighted factors.",
  },
  { name: "match", time: 26.5, caption: "The matcher chooses rooms from all pairs." },
  {
    name: "fairness",
    time: 34,
    caption: "The average hides the room. The fairness statement puts it first.",
  },
  { name: "documents", time: 40.5, caption: "Reasons, never raw answers." },
  { name: "signoff", time: 47.5, caption: "A person signs before keys are issued." },
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

test("the classic film stays available at ?classic=1", async ({ page }) => {
  await page.goto("/?classic=1");
  await expect(page.getByRole("group", { name: /sample run film/i })).toBeVisible();
  await expect(page.getByRole("group", { name: /cohort pipeline animation/i })).toHaveCount(0);
});

for (const viewport of VIEWPORTS) {
  test.describe(`full cohort pipeline at ${viewport.name}`, () => {
    test.setTimeout(300_000);
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });

    test("autoplays, holds all eight stations and supports review controls", async ({
      page,
    }) => {
      const apiCalls: string[] = [];
      const consoleErrors: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/")) apiCalls.push(request.url());
      });
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);

      const stage = page.locator(".cp-stage");
      const film = page.locator(".cp-film");
      await expect(stage).toBeVisible();
      await expect(stage).toHaveAttribute("data-playing", "true");
      await expect(page.getByRole("button", { name: "Pause pipeline" })).toBeVisible();

      // Autoplay is not gated on intersection.
      await page.waitForTimeout(1300);
      const liveTime = await page.locator(".cp-timecode").innerText();
      expect(liveTime).not.toBe("00:00.0 / 00:50");

      await page.getByRole("button", { name: "Pause pipeline" }).click();
      await expect(stage).toHaveAttribute("data-playing", "false");
      const pausedAt = await page.locator(".cp-timecode").innerText();
      await page.waitForTimeout(700);
      expect(await page.locator(".cp-timecode").innerText()).toBe(pausedAt);

      await page.getByRole("button", { name: "Play pipeline", exact: true }).click();
      await page.waitForTimeout(500);
      expect(await page.locator(".cp-timecode").innerText()).not.toBe(pausedAt);
      await page.getByRole("button", { name: "Pause pipeline" }).click();

      await noHorizontalOverflow(page, viewport.name);

      for (const stationInfo of STATIONS) {
        await setPipelineTime(page, stationInfo.time);
        const station = stage.locator(`[data-station="${stationInfo.name}"]`);
        await expect(page.locator(".cp-caption-line")).toHaveText(stationInfo.caption);

        if (stationInfo.name === "inputs") {
          for (const value of ["96", "38", "12"]) {
            await expectFullyInside(
              station.getByText(value, { exact: true }),
              stage,
              `inputs ${value}`,
            );
          }
        }

        if (stationInfo.name === "form") {
          await expect(station.getByText("Sealed", { exact: true })).toBeVisible();
          await expect(
            station
              .locator(".cp-normalised")
              .getByText("Normalised preferences", { exact: false }),
          ).toBeVisible();
          await expectFullyInside(
            station.locator(".cp-normalised"),
            stage,
            "normalised slip",
          );
        }

        if (stationInfo.name === "boundaries") {
          for (const value of ["4,560", "3,456", "1,104"]) {
            await expectFullyInside(station.getByText(value, { exact: true }), stage, value);
          }
          await expect(
            station.getByText("Open · R-12 · 12 rooms", { exact: true }),
          ).toBeVisible();
          await expect(station.getByText("M · 1st · AC", { exact: true })).toBeVisible();
          await expect(station.getByText("F · 2nd–4th · Non-AC", { exact: true })).toBeVisible();
        }

        if (stationInfo.name === "score") {
          const sheet = station.locator(".cp-score-sheet");
          await expect(
            page.getByText(
              "Three zeros and one blank answer. The remaining weights renormalise.",
              { exact: true },
            ),
          ).toBeVisible();
          await expect(
            station.getByText("Bar = raw factor score · weights are effective.", {
              exact: true,
            }),
          ).toBeVisible();
          const score = station.getByText("0.416", { exact: true });
          await expectFullyInside(score, stage, "pair score");
          const scoreSize = await score.evaluate(
            (node) => Number.parseFloat(getComputedStyle(node).fontSize),
          );
          expect(scoreSize, "pair score is large enough to read").toBeGreaterThanOrEqual(44);

          const factorNames = station.locator(".cp-factor-name");
          const factorScores = station.locator(".cp-factor-score b");
          const factorWeights = station.locator(".cp-factor-weight");
          await expect(factorNames).toHaveCount(10);
          await expect(factorScores).toHaveCount(10);
          await expect(station.locator(".cp-factor.is-zero")).toHaveCount(3);
          await expect(station.locator(".cp-factor.is-missing")).toHaveCount(1);
          await expect(station.locator(".cp-factor.is-missing")).toContainText(
            "Sleep schedule",
          );
          for (let index = 0; index < 3; index += 1) {
            await expect(
              station.locator(".cp-factor.is-zero .cp-factor-score b").nth(index),
            ).toHaveText("0.00");
          }
          await expect(
            station.locator(".cp-factor-score b").filter({ hasText: "0.25" }),
          ).toHaveCount(1);

          for (let index = 0; index < 10; index += 1) {
            const factor = factorNames.nth(index);
            const value = factorScores.nth(index);
            const weight = factorWeights.nth(index);
            await expectFullyInside(factor, sheet, `factor name ${index}`);
            await expectFullyInside(value, sheet, `factor score ${index}`);
            await expectFullyInside(weight, sheet, `factor weight ${index}`);
            const nameSize = await factor.evaluate(
              (node) => Number.parseFloat(getComputedStyle(node).fontSize),
            );
            const valueSize = await value.evaluate(
              (node) => Number.parseFloat(getComputedStyle(node).fontSize),
            );
            const weightSize = await weight.evaluate(
              (node) => Number.parseFloat(getComputedStyle(node).fontSize),
            );
            expect(nameSize, `factor name ${index} is not tiny`).toBeGreaterThanOrEqual(11);
            expect(valueSize, `factor value ${index} is not tiny`).toBeGreaterThanOrEqual(11);
            expect(weightSize, `factor weight ${index} is not tiny`).toBeGreaterThanOrEqual(9);
          }
        }

        if (stationInfo.name === "match") {
          const rooms = station.getByText("38", { exact: true });
          await expectFullyInside(rooms, stage, "38 rooms");
          await expect(station.getByText("2-bed", { exact: true })).toBeVisible();
          await expect(station.getByText("3-bed", { exact: true })).toBeVisible();
          await expect(station.getByText("4-bed", { exact: true })).toBeVisible();
          await expect(station.locator(".cp-graph-line")).toHaveCount(12);
          await expect(station.locator(".cp-graph-room.is-risk")).toHaveCount(1);
          const strategyCounts = station.locator(".cp-strategy > strong");
          await expect(strategyCounts).toHaveCount(3);
          for (const [index, value] of ["24", "8", "6"].entries()) {
            await expect(strategyCounts.nth(index)).toContainText(value);
            await expectFullyInside(
              strategyCounts.nth(index),
              stage,
              `${value} rooms`,
            );
          }
        }

        if (stationInfo.name === "fairness") {
          await expect(
            station.getByText("2 at risk · review required", { exact: true }),
          ).toBeVisible();
          await expect(station.locator(".cp-risk-card")).toHaveCount(2);
          await expect(station.locator(".cp-fair-thread")).toBeVisible();
          await expectFullyInside(
            station.getByText("0.827", { exact: false }).first(),
            stage,
            "segment mean",
          );
          await expectFullyInside(
            station.getByText("0.416", { exact: true }).first(),
            stage,
            "fairness floor",
          );
          await expect(
            station.locator(".cp-swap-ledger").getByText(/3 passes/),
          ).toBeVisible();
          await expect(
            station.locator(".cp-swap-ledger").getByText(/3 accepted/),
          ).toBeVisible();
          await expect(
            station.locator(".cp-swap-ledger").getByText(/0 new Poor/),
          ).toBeVisible();
        }

        if (stationInfo.name === "documents") {
          await expect(station.getByText("96", { exact: true })).toBeVisible();
          await expect(station.getByText("RM-D1C916", { exact: true })).toBeVisible();
          await expect(station.getByText(/D1C9167C/)).toBeVisible();
          await expect(station.getByText("Sealed", { exact: true })).toBeVisible();
          await expect(station.locator(".cp-doc-card")).toHaveCount(4);
          await expectFullyInside(
            station.getByText("96", { exact: true }),
            stage,
            "96 notes",
          );
        }

        if (stationInfo.name === "signoff") {
          await expect(
            station.getByText("38 rooms · 96 beds", { exact: true }),
          ).toBeVisible();
          await expect(
            station.getByText("2 · R-12 · review required", { exact: true }),
          ).toBeVisible();
          await expect(station.getByText("Signed by a person", { exact: true })).toBeVisible();
          await expect(station.getByText("After the signature", { exact: true })).toBeVisible();
          await expect(station.getByText("held", { exact: true })).toBeVisible();
          await expect(station.locator(".cp-wax-sign")).toBeVisible();
          await expect(station.locator(".cp-sign-stroke path")).toBeVisible();
          await expectFullyInside(
            station.getByText("0.416", { exact: true }),
            stage,
            "sign-off floor",
          );
        }
      }

      // Rail seek pauses at the settled station frame.
      await page.getByRole("button", { name: "Step 6: Fairness" }).click();
      await expect(page.locator(".cp-timecode")).toContainText("00:34.0");
      await expect(stage).toHaveAttribute("data-playing", "false");
      await expect(page.locator(".cp-caption-line")).toHaveText(
        "The average hides the room. The fairness statement puts it first.",
      );

      // End with Replay, then restart.
      await setPipelineTime(page, 50);
      await expect(page.getByText("End of take")).toBeVisible();
      await page.getByRole("button", { name: "Replay pipeline", exact: true }).click();
      await expect(stage).toHaveAttribute("data-playing", "true");
      await expect(
        page.getByText("A roster, a room list, a private form."),
      ).toBeVisible();

      // Stage keyboard and slider.
      await stage.focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("button", { name: "Play pipeline", exact: true })).toBeVisible();
      await page.locator(".cp-scrub").focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(".cp-timecode")).not.toContainText("00:00.0");

      await expect(stage.locator(".cp-world")).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator(".cp-caption")).toHaveAttribute("aria-live", "polite");
      await expect(film).toBeVisible();

      expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toEqual([]);
      expect(apiCalls, `homepage called the API: ${apiCalls.join(", ")}`).toEqual([]);
      await noHorizontalOverflow(page, viewport.name);
    });
  });
}
