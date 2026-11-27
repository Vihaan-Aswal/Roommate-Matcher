import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const STUDENT_HEADERS = [
  "admission_number",
  "full_name",
  "gender",
  "year_group",
  "ac_type",
  "room_size",
  "dob",
  "phone_number",
];

const ROOM_HEADERS = ["room_id", "segment_key", "capacity"];

const TEMPLATE_DIR = pathToFileURL(`${resolve("public", "templates")}/`);

function readCsv(name: string): string[][] {
  const text = readFileSync(new URL(name, TEMPLATE_DIR), "utf8");
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

describe("CSV templates", () => {
  const students = readCsv("students.csv");
  const rooms = readCsv("rooms.csv");

  it("ships the exact student headers with three example rows", () => {
    expect(students[0]).toEqual(STUDENT_HEADERS);
    expect(students.slice(1)).toHaveLength(3);
  });

  it("ships the exact room headers with three example rows", () => {
    expect(rooms[0]).toEqual(ROOM_HEADERS);
    expect(rooms.slice(1)).toHaveLength(3);
  });

  it("references only student-derived segments, with matching capacity", () => {
    const segmentSizes = new Map<string, number>();
    for (const [, , gender, yearGroup, acType, roomSize] of students.slice(1)) {
      segmentSizes.set(`${gender}_${yearGroup}_${acType}_${roomSize}`, Number(roomSize));
    }

    for (const [, segmentKey, capacity] of rooms.slice(1)) {
      expect(segmentSizes.has(segmentKey)).toBe(true);
      expect(Number(capacity)).toBe(segmentSizes.get(segmentKey));
    }
  });
});
