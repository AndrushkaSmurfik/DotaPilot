import { describe, expect, it } from "vitest";
import {
  PRAISE_TIPS,
  SESSION_GAP_MS,
  formatDuration,
  lossStreak,
  postMatchMessages,
  sessionMessage,
  sessionStart,
  streakMessage,
  type MatchLite,
} from "./logic";

const MIN = 60_000;
const now = Date.UTC(2026, 9, 28, 22, 0);
const match = (endedMinAgo: number, won: boolean, durMin = 40): MatchLite => ({
  won,
  ended_at: now - endedMinAgo * MIN,
  duration: durMin * 60,
});
const settings = { lossStreakWarn: 2, sessionWarnMinutes: 150, praiseReminder: true };

describe("lossStreak", () => {
  it("counts consecutive losses from the newest match regardless of input order", () => {
    expect(lossStreak([match(100, false), match(5, false), match(50, false), match(150, true)])).toBe(3);
    expect(lossStreak([match(5, true), match(50, false)])).toBe(0);
    expect(lossStreak([])).toBe(0);
  });

  it("treats sqlite 0/1 as booleans", () => {
    expect(lossStreak([{ won: 0, ended_at: now, duration: 1 }])).toBe(1);
  });
});

describe("sessionStart", () => {
  it("chains matches with short breaks", () => {
    // ended 5 min ago (started 45 ago), ended 55 ago (started 95 ago)
    const start = sessionStart([match(5, true), match(55, false)], now, now);
    expect(start).toBe(now - 95 * MIN);
  });

  it("breaks the chain on a long pause", () => {
    const start = sessionStart([match(5, true), match(5 + 40 + 60, false)], now, now);
    expect(start).toBe(now - 45 * MIN);
  });

  it("falls back to app start when the last match is old", () => {
    const appStart = now - 10 * MIN;
    expect(sessionStart([match(SESSION_GAP_MS / MIN + 1, true)], now, appStart)).toBe(appStart);
  });
});

describe("messages", () => {
  it("escalates the streak message", () => {
    expect(streakMessage(1, 2)).toBeNull();
    expect(streakMessage(2, 2)).toMatchObject({ level: "info" });
    expect(streakMessage(3, 2)?.text).toContain("3 поражения подряд");
    expect(streakMessage(5, 2)?.text).toContain("5 поражений");
  });

  it("warns about long sessions", () => {
    expect(sessionMessage(100, 150)).toBeNull();
    expect(sessionMessage(160, 150)?.text).toContain("2 ч 40 мин");
    expect(sessionMessage(230, 150)?.level).toBe("warn");
    expect(formatDuration(45)).toBe("45 мин");
  });

  it("builds the post-match set", () => {
    const history = [match(1, false), match(45, false), match(90, false), match(135, false)];
    const msgs = postMatchMessages(history, now, now, settings, 1);
    expect(msgs.map((m) => m.kind)).toEqual(["streak", "session", "praise"]);
    expect(msgs[2].text).toBe(PRAISE_TIPS[1]);
  });

  it("only praises after a win in a short session, and can be disabled", () => {
    expect(postMatchMessages([match(1, true)], now, now, settings, 0).map((m) => m.kind)).toEqual(["praise"]);
    expect(postMatchMessages([match(1, true)], now, now, { ...settings, praiseReminder: false })).toEqual([]);
  });
});
