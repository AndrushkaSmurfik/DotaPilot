import { describe, expect, it } from "vitest";
import { comboFromEvent, duplicateHotkeys, prettyHotkey } from "./hotkey";
import {
  FINISHED_GRACE,
  parseDuration,
  pruneFinished,
  remaining,
  runAlerts,
  startRun,
  validateDef,
  type CustomTimerDef,
} from "./model";

const def: CustomTimerDef = { id: "d1", name: "Смок", duration: 420, hotkey: "Alt+S", voice: true, lead: 10 };
const key = (code: string, mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>> = {}) => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe("custom timers", () => {
  it("counts on the game clock when started in a match", () => {
    const run = startRun(def, 600, 1_000_000, "r1");
    expect(remaining(run, 600, 1_000_000)).toBe(420);
    // Paused game: wall time passes, clock doesn't.
    expect(remaining(run, 700, 9_999_999)).toBe(320);
  });

  it("falls back to wall time outside a match", () => {
    const run = startRun(def, undefined, 1_000_000, "r1");
    expect(run.startClock).toBeNull();
    expect(remaining(run, undefined, 1_000_000 + 20_500)).toBe(400);
  });

  it("keeps finished timers for a short grace period", () => {
    const run = startRun(def, 0, 0, "r1");
    expect(pruneFinished([run], 420 + FINISHED_GRACE - 1, 0)).toHaveLength(1);
    expect(pruneFinished([run], 420 + FINISHED_GRACE, 0)).toHaveLength(0);
  });

  it("announces the lead and the end once", () => {
    expect(runAlerts(def, 11, 10)).toEqual(["Смок через 10 секунд"]);
    expect(runAlerts(def, 10, 9)).toEqual([]);
    expect(runAlerts(def, 1, 0)).toEqual(["Смок готов"]);
    expect(runAlerts(def, 15, -2)).toEqual(["Смок через 10 секунд", "Смок готов"]);
    expect(runAlerts({ ...def, voice: false }, 1, 0)).toEqual([]);
  });

  it("parses durations", () => {
    expect(parseDuration("8:00")).toBe(480);
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("1:02:00")).toBe(3720);
    expect(parseDuration("1:75")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("0")).toBeNull();
  });

  it("validates definitions", () => {
    expect(validateDef(def)).toBeNull();
    expect(validateDef({ ...def, name: "  " })).toBe("Введите название");
    expect(validateDef({ ...def, lead: 500 })).toMatch(/меньше длительности/);
  });
});

describe("hotkeys", () => {
  it("builds Tauri shortcut strings", () => {
    expect(comboFromEvent(key("KeyR", { altKey: true }))).toBe("Alt+R");
    expect(comboFromEvent(key("KeyR", { ctrlKey: true, altKey: true }))).toBe("CommandOrControl+Alt+R");
    expect(comboFromEvent(key("F5"))).toBe("F5");
    expect(comboFromEvent(key("Numpad3", { shiftKey: true }))).toBe("Shift+Num3");
  });

  it("refuses bare letters and modifier-only presses", () => {
    expect(comboFromEvent(key("KeyR"))).toBeNull();
    expect(comboFromEvent(key("AltLeft", { altKey: true }))).toBeNull();
  });

  it("prettifies and finds duplicates", () => {
    expect(prettyHotkey("CommandOrControl+Alt+R")).toBe("Ctrl+Alt+R");
    expect(prettyHotkey("")).toBe("—");
    expect([...duplicateHotkeys(["Alt+R", "alt+r", "Alt+G", ""])]).toEqual(["alt+r"]);
  });
});
