import { describe, expect, it } from "vitest";

import {
  PIPELINE_DURATION,
  cameraAt,
  cardArrivalAt,
  documentSealAt,
  documentsAt,
  fairnessBarsAt,
  fairnessMeanAt,
  fairnessRiskAt,
  fairnessSwapAt,
  fairnessThreadAt,
  foldersAt,
  formatFilmTime,
  keyAt,
  ledgerAt,
  matchAt,
  normalisedAt,
  notesAt,
  openAt,
  roomsAt,
  sealAt,
  signSlipAt,
  stampAt,
  stationOpacityAt,
  stepIndexAt,
  strategyAt,
  travelAt,
  waxAt,
} from "../../components/home/pipelineTimeline";

describe("full cohort pipeline timeline", () => {
  it("trucks one station at a time and settles on all eight stations", () => {
    expect(cameraAt(0)).toBe(0);
    expect(cameraAt(4)).toBe(0);
    expect(cameraAt(4.5)).toBe(1);
    expect(cameraAt(9.5)).toBe(1);
    expect(cameraAt(10)).toBe(2);
    expect(cameraAt(16.5)).toBe(3);
    expect(cameraAt(23.5)).toBe(4);
    expect(cameraAt(31)).toBe(5);
    expect(cameraAt(38.5)).toBe(6);
    expect(cameraAt(44)).toBe(7);
    expect(cameraAt(PIPELINE_DURATION)).toBe(7);
  });

  it("names all eight stations at their arrival times", () => {
    expect(stepIndexAt(0)).toBe(0);
    expect(stepIndexAt(4.49)).toBe(0);
    expect(stepIndexAt(4.5)).toBe(1);
    expect(stepIndexAt(9.99)).toBe(1);
    expect(stepIndexAt(10)).toBe(2);
    expect(stepIndexAt(16.5)).toBe(3);
    expect(stepIndexAt(23.5)).toBe(4);
    expect(stepIndexAt(31)).toBe(5);
    expect(stepIndexAt(38.5)).toBe(6);
    expect(stepIndexAt(44)).toBe(7);
    expect(stepIndexAt(50)).toBe(7);
  });

  it("hides both station bodies while the camera is between stations", () => {
    expect(stationOpacityAt(4.2, 0)).toBe(0);
    expect(stationOpacityAt(4.2, 1)).toBe(0);
    expect(stationOpacityAt(9.8, 1)).toBe(0);
    expect(stationOpacityAt(9.8, 2)).toBe(0);
    expect(stationOpacityAt(16.3, 2)).toBe(0);
    expect(stationOpacityAt(16.3, 3)).toBe(0);
    expect(stationOpacityAt(23.3, 3)).toBe(0);
    expect(stationOpacityAt(23.3, 4)).toBe(0);
    expect(stationOpacityAt(43.8, 6)).toBe(0);
    expect(stationOpacityAt(43.8, 7)).toBe(0);
  });

  it("fully frames each station after arrival and holds the score to read", () => {
    expect(stationOpacityAt(0, 0)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(3.9, 0)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(4.64, 1)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(9.4, 1)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(10.14, 2)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(16.64, 3)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(19, 3)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(22.9, 3)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(23.64, 4)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(31.64, 5)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(38.64, 6)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(44.14, 7)).toBeCloseTo(1, 6);
    expect(stationOpacityAt(50, 7)).toBeCloseTo(1, 6);
  });

  it("runs the paper beats for inputs, form and boundaries", () => {
    expect(cardArrivalAt(4.6)).toBe(0);
    expect(cardArrivalAt(6.2)).toBeCloseTo(1, 6);
    expect(sealAt(6.3)).toBe(0);
    expect(sealAt(6.65)).toBeCloseTo(1, 6);
    expect(normalisedAt(6.7)).toBe(0);
    expect(normalisedAt(7.3)).toBeCloseTo(1, 6);
    expect(stampAt(10.1, 0)).toBe(0);
    expect(stampAt(10.28, 0)).toBeCloseTo(1, 6);
    expect(stampAt(10.82, 3)).toBe(0);
    expect(stampAt(11, 3)).toBeCloseTo(1, 6);
    expect(foldersAt(10.95)).toBe(0);
    expect(foldersAt(11.4)).toBeCloseTo(1, 6);
    expect(ledgerAt(11.2)).toBe(0);
    expect(ledgerAt(11.7)).toBeCloseTo(1, 6);
    expect(openAt(11.7)).toBe(0);
    expect(openAt(12.2)).toBeCloseTo(1, 6);
  });

  it("runs the match and fairness beats", () => {
    expect(matchAt(23.7)).toBe(0);
    expect(matchAt(25.2)).toBeCloseTo(1, 6);
    expect(strategyAt(24.3)).toBe(0);
    expect(strategyAt(24.9)).toBeCloseTo(1, 6);
    expect(roomsAt(24.7)).toBe(0);
    expect(roomsAt(25.1)).toBeCloseTo(1, 6);
    expect(fairnessBarsAt(31.3)).toBe(0);
    expect(fairnessBarsAt(32.1)).toBeCloseTo(1, 6);
    expect(fairnessMeanAt(31.9)).toBe(0);
    expect(fairnessMeanAt(32.3)).toBeCloseTo(1, 6);
    expect(fairnessThreadAt(32.1)).toBe(0);
    expect(fairnessThreadAt(32.9)).toBeCloseTo(1, 6);
    expect(fairnessRiskAt(32.4)).toBe(0);
    expect(fairnessRiskAt(32.9)).toBeCloseTo(1, 6);
    expect(fairnessSwapAt(32.8)).toBe(0);
    expect(fairnessSwapAt(33.2)).toBeCloseTo(1, 6);
  });

  it("runs the documents and sign-off beats", () => {
    expect(documentsAt(38.7)).toBe(0);
    expect(documentsAt(39.4)).toBeCloseTo(1, 6);
    expect(notesAt(39.2)).toBe(0);
    expect(notesAt(39.8)).toBeCloseTo(1, 6);
    expect(documentSealAt(39.5)).toBe(0);
    expect(documentSealAt(39.9)).toBeCloseTo(1, 6);
    expect(signSlipAt(44.1)).toBe(0);
    expect(signSlipAt(44.6)).toBeCloseTo(1, 6);
    expect(waxAt(45.8)).toBe(0);
    expect(waxAt(46.2)).toBeCloseTo(1, 6);
    expect(keyAt(46.1)).toBe(0);
    expect(keyAt(46.4)).toBeCloseTo(1, 6);
  });

  it("lifts the pack only while the camera travels", () => {
    expect(travelAt(2)).toBe(0);
    expect(travelAt(4.3)).toBeCloseTo(1, 5);
    expect(travelAt(9.8)).toBeCloseTo(1, 5);
    expect(travelAt(16.3)).toBeCloseTo(1, 5);
    expect(travelAt(23.3)).toBeCloseTo(1, 5);
    expect(travelAt(30.8)).toBeCloseTo(1, 5);
    expect(travelAt(38.3)).toBeCloseTo(1, 5);
    expect(travelAt(43.8)).toBeCloseTo(1, 5);
    expect(travelAt(50)).toBe(0);
  });

  it("formats the full timecode without locale drift", () => {
    expect(formatFilmTime(0)).toBe("00:00.0");
    expect(formatFilmTime(4.5)).toBe("00:04.5");
    expect(formatFilmTime(50)).toBe("00:50.0");
    expect(formatFilmTime(60)).toBe("00:50.0");
  });
});
