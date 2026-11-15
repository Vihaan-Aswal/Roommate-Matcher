// @vitest-environment node
import { describe, expect, it } from "vitest";

import { cn, csvCell } from "../../lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("lets a later Tailwind class win over an earlier conflict", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("ignores falsy and conditional entries", () => {
    expect(cn("flex", false && "hidden", undefined, null, "", "gap-2")).toBe("flex gap-2");
  });

  it("accepts arrays and object maps", () => {
    expect(cn(["flex", ["gap-2"]], { "items-center": true, hidden: false })).toBe(
      "flex gap-2 items-center",
    );
  });

  it("returns an empty string when there is nothing to join", () => {
    expect(cn()).toBe("");
  });
});

describe("csvCell", () => {
  it("leaves plain values untouched", () => {
    expect(csvCell("ADM001")).toBe("ADM001");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("Doe, Jane")).toBe('"Doe, Jane"');
    expect(csvCell('Jane "JJ" Doe')).toBe('"Jane ""JJ"" Doe"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });
});
