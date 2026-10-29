import { describe, expect, it } from "vitest";
import { DEFAULT_TIMER_SETTINGS, type TimerId, type TimerSettings } from "./config";
import {
  buildSchedules,
  computeTimers,
  dueAlerts,
  fixedTimes,
  formatClock,
  isDay,
  periodic,
} from "./logic";

const only = (ids: TimerId[], patch: Partial<TimerSettings> = {}) =>
  Object.fromEntries(
    Object.entries(DEFAULT_TIMER_SETTINGS).map(([id, s]) => [
      id,
      { ...s, ...patch, enabled: ids.includes(id as TimerId), voice: ids.includes(id as TimerId) },
    ]),
  ) as Record<TimerId, TimerSettings>;

const next = (id: TimerId, clock: number, marks = {}) => buildSchedules(marks)[id](clock);

describe("schedules", () => {
  it("periodic returns the first event before start and strictly-next after", () => {
    const s = periodic(360, 120);
    expect(s(-90)).toBe(360);
    expect(s(359)).toBe(360);
    expect(s(360)).toBe(480);
    expect(s(479)).toBe(480);
  });

  it("fixedTimes runs out", () => {
    const s = fixedTimes([20, 10]);
    expect(s(0)).toBe(10);
    expect(s(10)).toBe(20);
    expect(s(20)).toBeNull();
  });

  it("bounty runes at 0:00 then every 3 min", () => {
    expect(next("bounty", -30)).toBe(0);
    expect(next("bounty", 0)).toBe(180);
    expect(next("bounty", 1000)).toBe(1080);
  });

  it("power runes from 6:00 every 2 min, wisdom every 7 min", () => {
    expect(next("power", 100)).toBe(360);
    expect(next("power", 365)).toBe(480);
    expect(next("wisdom", 0)).toBe(420);
    expect(next("wisdom", 420)).toBe(840);
  });

  it("stacks at xx:53 from 1:53", () => {
    expect(next("stack", 30)).toBe(113);
    expect(next("stack", 113)).toBe(173);
    expect(next("stack", 600)).toBe(653);
  });

  it("lotus every 3 min, tormentor once at 20:00", () => {
    expect(next("lotus", 179)).toBe(180);
    expect(next("tormentor", 1199)).toBe(1200);
    expect(next("tormentor", 1200)).toBeNull();
  });

  it("tormentor respawns 10 min after the hotkey mark", () => {
    const marks = { tormentorKilledAt: 1500 };
    expect(next("tormentor", 1500, marks)).toBe(2100);
    expect(next("tormentor", 2100, marks)).toBeNull();
  });

  it("day/night switches every 5 min", () => {
    expect(isDay(-60)).toBe(true);
    expect(isDay(299)).toBe(true);
    expect(isDay(300)).toBe(false);
    expect(isDay(600)).toBe(true);
    expect(next("daynight", 0)).toBe(300);
    expect(next("daynight", 300)).toBe(600);
  });

  it("neutral tiers end after tier 5", () => {
    expect(next("neutrals", 0)).toBe(300);
    expect(next("neutrals", 2100)).toBe(3600);
    expect(next("neutrals", 3600)).toBeNull();
  });

  it("manual timers need a mark", () => {
    expect(next("roshan", 100)).toBeNull();
    expect(next("glyph", 100)).toBeNull();
    const marks = { roshanKilledAt: 1000, glyphUses: [1500] };
    expect(next("roshan", 1000, marks)).toBe(1480);
    expect(next("roshan", 1480, marks)).toBe(1660);
    expect(next("roshan", 1660, marks)).toBeNull();
    expect(next("aegis", 1000, marks)).toBe(1300);
    expect(next("glyph", 1500, marks)).toBe(1800);
  });
});

describe("computeTimers", () => {
  it("sorts by remaining and labels phases", () => {
    const views = computeTimers(1100, DEFAULT_TIMER_SETTINGS, { roshanKilledAt: 1000 });
    expect(views[0].remaining).toBeLessThanOrEqual(views[1].remaining);
    const rosh = views.find((v) => v.id === "roshan")!;
    expect(rosh).toMatchObject({ at: 1480, remaining: 380, label: "Рошан: мин. респавн" });
    const later = computeTimers(1500, DEFAULT_TIMER_SETTINGS, { roshanKilledAt: 1000 });
    expect(later.find((v) => v.id === "roshan")!.label).toBe("Рошан: точно жив");
  });

  it("skips disabled timers", () => {
    const views = computeTimers(0, only(["power"]), {});
    expect(views.map((v) => v.id)).toEqual(["power"]);
  });

  it("labels night and neutral tiers", () => {
    const views = computeTimers(200, only(["daynight", "neutrals"]), {});
    expect(views.find((v) => v.id === "daynight")!.label).toBe("Наступит ночь");
    expect(views.find((v) => v.id === "neutrals")!.label).toBe("Нейтралки tier 1");
  });
});

describe("dueAlerts", () => {
  const power = only(["power"], { lead: 15 });

  it("fires once when the lead moment is crossed", () => {
    expect(dueAlerts(343, 344, power, {})).toEqual([]);
    expect(dueAlerts(344, 345, power, {})).toEqual([
      { id: "power", text: "Руна силы через 15 секунд" },
    ]);
    expect(dueAlerts(345, 346, power, {})).toEqual([]);
  });

  it("handles multi-second GSI steps", () => {
    expect(dueAlerts(340, 348, power, {})).toHaveLength(1);
  });

  it("ignores rewinds, pauses and large jumps", () => {
    expect(dueAlerts(345, 345, power, {})).toEqual([]);
    expect(dueAlerts(400, 300, power, {})).toEqual([]);
    expect(dueAlerts(0, 345, power, {})).toEqual([]);
  });

  it("respects the voice toggle", () => {
    const muted = { ...power, power: { ...power.power, voice: false } };
    expect(dueAlerts(344, 345, muted, {})).toEqual([]);
  });

  it("announces with zero lead using the bare label", () => {
    const glyph = only(["glyph"], { lead: 0 });
    expect(dueAlerts(1799, 1800, glyph, { glyphUses: [1500] })).toEqual([
      { id: "glyph", text: "Глиф врага готов" },
    ]);
  });

  it("announces each returning glyph charge when the enemy has two", () => {
    const glyph = only(["glyph"], { lead: 0 });
    const marks = { glyphUses: [1000, 1100], glyphCharges: 2 };
    expect(dueAlerts(1299, 1300, glyph, marks)).toEqual([{ id: "glyph", text: "Глиф врага: заряд 1 из 2" }]);
    expect(dueAlerts(1599, 1600, glyph, marks)).toEqual([{ id: "glyph", text: "Глиф врага: заряд 2 из 2" }]);
  });

  it("shows current and upcoming glyph charges", () => {
    const views = computeTimers(1150, only(["glyph"]), { glyphUses: [1000, 1100], glyphCharges: 2 });
    expect(views).toEqual([{ id: "glyph", label: "Глиф врага 0/2 → 1/2", at: 1300, remaining: 150 }]);
  });
});

describe("formatClock", () => {
  it("formats negative and positive times", () => {
    expect(formatClock(-85)).toBe("-1:25");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(653)).toBe("10:53");
  });
});
