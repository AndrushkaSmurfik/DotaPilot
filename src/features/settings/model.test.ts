import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, generateToken, isValidPort, mergeSettings } from "./model";

describe("settings model", () => {
  it("fills missing fields with defaults", () => {
    const s = mergeSettings({ gsiPort: 3555, timers: { power: { lead: 5 } } as never });
    expect(s.gsiPort).toBe(3555);
    expect(s.timers.power).toEqual({ ...DEFAULT_SETTINGS.timers.power, lead: 5 });
    expect(s.timers.bounty).toEqual(DEFAULT_SETTINGS.timers.bounty);
    expect(s.hotkeys).toEqual(DEFAULT_SETTINGS.hotkeys);
  });

  it("moves untouched legacy hotkeys to Alt+… but keeps custom ones", () => {
    const s = mergeSettings({
      hotkeys: { roshan: "CommandOrControl+Alt+R", glyph: "F7" } as never,
    });
    expect(s.hotkeys.roshan).toBe("Alt+R");
    expect(s.hotkeys.glyph).toBe("F7");
    expect(s.customTimers).toEqual([]);
  });

  it("handles empty storage", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("generates tokens the backend accepts", () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{48}$/);
    expect(generateToken()).not.toBe(t);
  });

  it("validates ports", () => {
    expect(isValidPort(3000)).toBe(true);
    expect(isValidPort(80)).toBe(false);
    expect(isValidPort(70000)).toBe(false);
  });
});
