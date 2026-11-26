import { describe, expect, it } from "vitest";

import {
  CAPTIONS,
  DESKTOP_CAMERA,
  FILM_DURATION,
  MOBILE_CAMERA,
  cameraAt,
  captionIndexAt,
  factorRevealAt,
  formatFilmTime,
  formatMarker,
  lampAt,
  scorePressAt,
  threadAt,
} from "../../components/home/continuousTimeline";

describe("continuous film timeline", () => {
  it("moves the camera continuously and keeps the frame inside the world", () => {
    const cases = [
      { name: "desk", frames: DESKTOP_CAMERA, worldHeight: 1 },
      { name: "portrait", frames: MOBILE_CAMERA, worldHeight: 1.35 },
    ];

    for (const { name, frames, worldHeight } of cases) {
      let previous = cameraAt(0, frames);
      for (let time = 0; time <= FILM_DURATION; time += 0.05) {
        const camera = cameraAt(time, frames);
        const halfWidth = 0.5 / camera.scale;
        const halfHeight = 0.5 / (worldHeight * camera.scale);

        expect(camera.x - halfWidth, `${name} left at ${time}`).toBeGreaterThanOrEqual(-0.0001);
        expect(camera.x + halfWidth, `${name} right at ${time}`).toBeLessThanOrEqual(1.0001);
        expect(camera.y - halfHeight, `${name} top at ${time}`).toBeGreaterThanOrEqual(-0.0001);
        expect(camera.y + halfHeight, `${name} bottom at ${time}`).toBeLessThanOrEqual(1.0001);
        expect(Math.abs(camera.x - previous.x), `${name} x jump at ${time}`).toBeLessThan(0.05);
        expect(Math.abs(camera.y - previous.y), `${name} y jump at ${time}`).toBeLessThan(0.05);
        expect(Math.abs(camera.scale - previous.scale), `${name} scale jump at ${time}`).toBeLessThan(0.05);
        previous = camera;
      }
    }
  });

  it("keeps every evidence object fully in or fully out at the paused beats", () => {
    for (const time of [5.5, 6.8, 7.4, 8.1]) {
      const camera = cameraAt(time, DESKTOP_CAMERA);
      const half = 0.5 / camera.scale;
      const left = camera.x - half;
      const right = camera.x + half;
      const top = camera.y - half;
      const bottom = camera.y + half;

      // The roster and envelope end before the frame; the folders and ledger
      // are fully inside it.
      expect(left, `desktop left at ${time}`).toBeGreaterThan(0.235);
      expect(left, `desktop left at ${time}`).toBeLessThan(0.25);
      expect(right, `desktop right at ${time}`).toBeGreaterThan(0.98);
      expect(right, `desktop right at ${time}`).toBeLessThanOrEqual(1);
      expect(top, `desktop top at ${time}`).toBeLessThan(0.12);
      expect(bottom, `desktop bottom at ${time}`).toBeGreaterThan(0.83);
    }

    for (const time of [2.9, 5.5, 6.8, 7.4, 8.1]) {
      const camera = cameraAt(time, MOBILE_CAMERA);
      const half = 0.5 / (1.35 * camera.scale);
      const top = camera.y - half;
      const bottom = camera.y + half;

      // The roster is above the frame; the boundary ledger, folders and
      // ledger are all below its top edge and above its bottom edge.
      expect(top, `portrait top at ${time}`).toBeGreaterThan(0.17);
      expect(top, `portrait top at ${time}`).toBeLessThan(0.26);
      expect(bottom, `portrait bottom at ${time}`).toBeGreaterThan(0.85);
      expect(bottom, `portrait bottom at ${time}`).toBeLessThanOrEqual(1);
    }
  });

  it("clamps the playhead to the ten-second take", () => {
    expect(cameraAt(-2, DESKTOP_CAMERA)).toEqual(cameraAt(0, DESKTOP_CAMERA));
    expect(cameraAt(20, DESKTOP_CAMERA)).toEqual(
      cameraAt(FILM_DURATION, DESKTOP_CAMERA),
    );
    expect(lampAt(-1)).toBeCloseTo(lampAt(0));
    expect(lampAt(20)).toBeCloseTo(1);
    expect(threadAt(-1)).toBe(0);
    expect(threadAt(20)).toBe(1);
    expect(factorRevealAt(0)).toBe(0);
    expect(factorRevealAt(20)).toBe(1);
    expect(scorePressAt(0, 7)).toBe(0);
    expect(scorePressAt(8, 7)).toBe(1);
  });

  it("changes captions exactly at their marks", () => {
    expect(CAPTIONS).toHaveLength(4);
    expect(captionIndexAt(0)).toBe(0);
    expect(captionIndexAt(2.59)).toBe(0);
    expect(captionIndexAt(2.6)).toBe(1);
    expect(captionIndexAt(5.19)).toBe(1);
    expect(captionIndexAt(5.2)).toBe(2);
    expect(captionIndexAt(7.79)).toBe(2);
    expect(captionIndexAt(7.8)).toBe(3);
    expect(captionIndexAt(10)).toBe(3);
  });

  it("formats the timecode and chapter marks", () => {
    expect(formatFilmTime(0)).toBe("00:00.0");
    expect(formatFilmTime(4.26)).toBe("00:04.3");
    expect(formatFilmTime(10)).toBe("00:10.0");
    expect(formatMarker(0)).toBe("0:00");
    expect(formatMarker(7.8)).toBe("0:08");
  });
});
