import {
  PATCH,
  TIMER_IDS,
  TIMER_LABELS,
  type ManualMarks,
  type TimerId,
  type TimerSettings,
} from "./config";
import { glyphRestoreTimes, glyphState } from "./glyph";

/** Next event time of a schedule strictly after `t`, or null if there are no more. */
export type Schedule = (t: number) => number | null;

export interface TimerView {
  id: TimerId;
  label: string;
  /** clock_time of the event. */
  at: number;
  remaining: number;
}

export interface Alert {
  id: TimerId;
  text: string;
}

/** Larger jumps (seek, reconnect mid-game) don't trigger alerts to avoid a burst. */
export const MAX_ALERT_GAP = 30;

export function periodic(first: number, interval: number): Schedule {
  return (t) => {
    if (t < first) return first;
    return first + (Math.floor((t - first) / interval) + 1) * interval;
  };
}

export function fixedTimes(times: readonly number[]): Schedule {
  const sorted = [...times].sort((a, b) => a - b);
  return (t) => sorted.find((x) => x > t) ?? null;
}

export function isDay(clock: number): boolean {
  return clock < 0 || Math.floor(clock / PATCH.dayNight.phase) % 2 === 0;
}

export function buildSchedules(marks: ManualMarks): Record<TimerId, Schedule> {
  const none: Schedule = () => null;
  const rosh = marks.roshanKilledAt;
  const glyphUses = marks.glyphUses ?? [];
  const tormentor = marks.tormentorKilledAt;
  return {
    bounty: periodic(PATCH.bountyRune.first, PATCH.bountyRune.interval),
    power: periodic(PATCH.powerRune.first, PATCH.powerRune.interval),
    wisdom: periodic(PATCH.wisdomRune.first, PATCH.wisdomRune.interval),
    lotus: periodic(PATCH.lotus.first, PATCH.lotus.interval),
    stack: periodic(PATCH.stack.first, PATCH.stack.interval),
    tormentor: fixedTimes([
      tormentor === undefined ? PATCH.tormentor.first : tormentor + PATCH.tormentor.respawn,
    ]),
    daynight: periodic(PATCH.dayNight.phase, PATCH.dayNight.phase),
    neutrals: fixedTimes(PATCH.neutralTiers),
    roshan:
      rosh === undefined
        ? none
        : fixedTimes([rosh + PATCH.roshan.respawnMin, rosh + PATCH.roshan.respawnMax]),
    aegis: rosh === undefined ? none : fixedTimes([rosh + PATCH.aegis.duration]),
    glyph: glyphUses.length
      ? fixedTimes(glyphRestoreTimes(glyphUses, glyphMax(marks), PATCH.glyph.cooldown))
      : none,
  };
}

export function glyphMax(marks: ManualMarks): number {
  return Math.max(1, marks.glyphCharges ?? 1);
}

/** Human label for a timer whose next event is at `at` (`clock` = now, for live counters). */
export function labelFor(id: TimerId, at: number, marks: ManualMarks, clock?: number): string {
  switch (id) {
    case "daynight":
      return isDay(at) ? "Наступит день" : "Наступит ночь";
    case "neutrals":
      return `Нейтралки tier ${PATCH.neutralTiers.indexOf(at as (typeof PATCH.neutralTiers)[number]) + 1}`;
    case "roshan": {
      const min = (marks.roshanKilledAt ?? 0) + PATCH.roshan.respawnMin;
      return at === min ? "Рошан: мин. респавн" : "Рошан: точно жив";
    }
    case "tormentor":
      return marks.tormentorKilledAt === undefined ? "Тормент появится" : "Тормент: респавн";
    case "aegis":
      return "Аегис исчезнет";
    case "glyph": {
      const max = glyphMax(marks);
      if (max === 1) return "Глиф врага готов";
      const uses = marks.glyphUses ?? [];
      const then = glyphState(uses, at, max, PATCH.glyph.cooldown).charges;
      if (clock === undefined) return `Глиф врага: заряд ${then} из ${max}`;
      const nowCharges = glyphState(uses, clock, max, PATCH.glyph.cooldown).charges;
      return `Глиф врага ${nowCharges}/${max} → ${then}/${max}`;
    }
    default:
      return TIMER_LABELS[id];
  }
}

export function computeTimers(
  clock: number,
  settings: Record<TimerId, TimerSettings>,
  marks: ManualMarks,
): TimerView[] {
  const schedules = buildSchedules(marks);
  const views: TimerView[] = [];
  for (const id of TIMER_IDS) {
    if (!settings[id].enabled) continue;
    const at = schedules[id](clock);
    if (at === null) continue;
    views.push({ id, label: labelFor(id, at, marks, clock), at, remaining: at - clock });
  }
  return views.sort((a, b) => a.remaining - b.remaining);
}

export function alertText(id: TimerId, at: number, lead: number, marks: ManualMarks): string {
  const label = labelFor(id, at, marks);
  return lead > 0 ? `${label} через ${lead} секунд` : label;
}

/**
 * Alerts whose announce moment (event - lead) falls in (prev, cur].
 * Pure: the caller tracks `prev` between GSI ticks.
 */
export function dueAlerts(
  prev: number,
  cur: number,
  settings: Record<TimerId, TimerSettings>,
  marks: ManualMarks,
): Alert[] {
  if (cur <= prev || cur - prev > MAX_ALERT_GAP) return [];
  const schedules = buildSchedules(marks);
  const alerts: Alert[] = [];
  for (const id of TIMER_IDS) {
    const s = settings[id];
    if (!s.enabled || !s.voice) continue;
    const at = schedules[id](prev + s.lead);
    if (at !== null && at <= cur + s.lead) {
      alerts.push({ id, text: alertText(id, at, s.lead, marks) });
    }
  }
  return alerts;
}

export function formatClock(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(seconds));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}
