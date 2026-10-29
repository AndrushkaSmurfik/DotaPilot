import { describe, expect, it } from "vitest";
import { formatMarkTimes, reportReminder } from "./logic";

describe("report reminders", () => {
  it("lists unreported marks in game-clock order", () => {
    const msg = reportReminder([
      { clock: 1201, reported: 0 },
      { clock: 754, reported: 0 },
      { clock: 300, reported: 1 },
    ]);
    expect(msg?.kind).toBe("report");
    expect(msg?.text).toContain("(12:34, 20:01)");
    expect(msg?.text).toContain("вручную");
  });

  it("stays silent when nothing is pending", () => {
    expect(reportReminder([])).toBeNull();
    expect(reportReminder([{ clock: 10, reported: 1 }])).toBeNull();
  });

  it("formats times", () => {
    expect(formatMarkTimes([{ clock: 65 }, { clock: 5 }])).toBe("0:05, 1:05");
  });
});
