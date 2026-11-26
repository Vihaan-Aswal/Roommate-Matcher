import { describe, expect, it } from "vitest";

import {
  PIPELINE_DURATION,
  cameraAt,
  cardArrivalAt,
  foldersAt,
  formatFilmTime,
  ledgerAt,
  openAt,
  stampAt,
  stationOpacityAt,
  stepIndexAt,
  travelAt,
} from "../../components/home/pipelineTimeline";

describe("cohort pipeline timeline", () => {
  it("trucks one station at a time and settles on the station times", () => {
    expect(cameraAt(0)).toBe(0);
    expect(cameraAt(2)).toBe(0);
    expect(cameraAt(2.5)).toBe(1);
    expect(cameraAt(5)).toBe(1);
    expect(cameraAt(5.5)).toBe(2);
    expect(cameraAt(8)).toBe(2);
    expect(cameraAt(8.4)).toBe(3);
    expect(cameraAt(PIPELINE_DURATION)).toBe(3);
  });

  it("names the four built stations current at their beats", () => {
    expect(stepIndexAt(0)).toBe(0);
    expect(stepIndexAt(2.49)).toBe(0);
    expect(stepIndexAt(2.5)).toBe(1);
    expect(stepIndexAt(5.5)).toBe(2);
    expect(stepIndexAt(8.39)).toBe(2);
    expect(stepIndexAt(8.4)).toBe(3);
    expect(stepIndexAt(10)).toBe(3);
  });

  it("hides both station bodies while the camera is between stations", () => {
    expect(stationOpacityAt(2.325, 0)).toBe(0);
    expect(stationOpacityAt(2.325, 1)).toBe(0);
    expect(stationOpacityAt(5.325, 1)).toBe(0);
    expect(stationOpacityAt(5.325, 2)).toBe(0);
    expect(stationOpacityAt(8.2, 2)).toBe(0);
    expect(stationOpacityAt(8.2, 3)).toBe(0);
  });

  it("fully frames each station after arrival", () => {
    expect(stationOpacityAt(0, 0)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(2, 0)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(2.64, 1)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(5, 1)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(5.64, 2)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(7, 2)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(8.5, 3)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(9.5, 3)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(10, 3)).toBeCloseTo(1, 6);
  });

  it("runs the form, boundary and open-folder beats", () => {
    expect(cardArrivalAt(2.62)).toBe(0);
    expect(cardArrivalAt(4.04)).toBeCloseTo(1, 6);
    expect(stampAt(5.55, 0)).toBe(0);
    expect(stampAt(5.73, 0)).toBeCloseTo(1, 6);
    expect(stampAt(6.27, 3)).toBe(0);
    expect(stampAt(6.45, 3)).toBeCloseTo(1, 6);
    expect(foldersAt(6.15)).toBe(0);
    expect(foldersAt(6.5)).toBeCloseTo(1, 6);
    expect(ledgerAt(6.35)).toBe(0);
    expect(ledgerAt(6.7)).toBeCloseTo(1, 6);
    expect(openAt(6.6)).toBe(0);
    expect(openAt(7)).toBeCloseTo(1, 6);
  });

  it("lifts the pack only while the camera travels", () => {
    expect(travelAt(1)).toBe(0);
    expect(travelAt(2.325)).toBeCloseTo(1, 5);
    expect(travelAt(5.325)).toBeCloseTo(1, 5);
    expect(travelAt(8.225)).toBeCloseTo(1, 5);
    expect(travelAt(10)).toBe(0);
  });

  it("formats the timecode without locale drift", () => {
    expect(formatFilmTime(0)).toBe("00:00.0");
    expect(formatFilmTime(2.5)).toBe("00:02.5");
    expect(formatFilmTime(10)).toBe("00:10.0");
    expect(formatFilmTime(12)).toBe("00:10.0");
  });
});
