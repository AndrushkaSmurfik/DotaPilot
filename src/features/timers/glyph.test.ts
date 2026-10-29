import { describe, expect, it } from "vitest";
import { glyphRestoreTimes, glyphState } from "./glyph";

const CD = 300;

describe("glyph charges", () => {
  it("single charge behaves like the old cooldown", () => {
    expect(glyphState([], 100, 1, CD)).toEqual({ charges: 1, max: 1, nextAt: null });
    expect(glyphState([1000], 1100, 1, CD)).toEqual({ charges: 0, max: 1, nextAt: 1300 });
    expect(glyphState([1000], 1300, 1, CD)).toEqual({ charges: 1, max: 1, nextAt: null });
  });

  it("two charges: second press keeps the first restore running", () => {
    expect(glyphState([1000], 1050, 2, CD)).toEqual({ charges: 1, max: 2, nextAt: 1300 });
    expect(glyphState([1000, 1100], 1150, 2, CD)).toEqual({ charges: 0, max: 2, nextAt: 1300 });
    expect(glyphState([1000, 1100], 1300, 2, CD)).toEqual({ charges: 1, max: 2, nextAt: 1600 });
    expect(glyphState([1000, 1100], 1600, 2, CD)).toEqual({ charges: 2, max: 2, nextAt: null });
  });

  it("a restore in between: using a fresh charge doesn't reset the clock", () => {
    // 1000 use (1/2), 1300 back to 2/2, 1400 use → 1/2, restore at 1700.
    expect(glyphState([1000, 1400], 1450, 2, CD)).toEqual({ charges: 1, max: 2, nextAt: 1700 });
    // 1000 use, 1200 use (0/2), 1300 → 1/2 and restore continues to 1600.
    expect(glyphState([1000, 1200], 1350, 2, CD)).toEqual({ charges: 1, max: 2, nextAt: 1600 });
  });

  it("trusts a press with no charges left and restarts the restore", () => {
    expect(glyphState([1000, 1100], 1150, 1, CD)).toEqual({ charges: 0, max: 1, nextAt: 1400 });
  });

  it("ignores presses in the future of the asked clock", () => {
    expect(glyphState([1000, 2000], 1500, 2, CD)).toEqual({ charges: 2, max: 2, nextAt: null });
  });

  it("lists every upcoming restore", () => {
    expect(glyphRestoreTimes([], 2, CD)).toEqual([]);
    expect(glyphRestoreTimes([1000], 1, CD)).toEqual([1300]);
    expect(glyphRestoreTimes([1000, 1100], 2, CD)).toEqual([1300, 1600]);
    expect(glyphRestoreTimes([1000, 1400], 2, CD)).toEqual([1300, 1700]);
  });
});
