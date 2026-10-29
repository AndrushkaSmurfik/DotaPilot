// Anti-tilt: pure functions over the match history. Only ever produces text for the user.

export interface MatchLite {
  won: boolean | number;
  /** ms since epoch */
  ended_at: number;
  /** seconds */
  duration: number;
}

export interface TiltSettings {
  lossStreakWarn: number;
  sessionWarnMinutes: number;
  praiseReminder: boolean;
}

export interface TiltMessage {
  kind: "streak" | "session" | "praise" | "report";
  level: "info" | "warn";
  text: string;
}

/** Matches separated by more than this start a new session. */
export const SESSION_GAP_MS = 45 * 60_000;

const byNewest = (ms: MatchLite[]) => [...ms].sort((a, b) => b.ended_at - a.ended_at);

export function lossStreak(matches: MatchLite[]): number {
  let n = 0;
  for (const m of byNewest(matches)) {
    if (m.won) break;
    n++;
  }
  return n;
}

/** Start of the current play session (ms), or `fallback` if no recent matches. */
export function sessionStart(matches: MatchLite[], now: number, fallback: number): number {
  const sorted = byNewest(matches);
  if (!sorted.length || now - sorted[0].ended_at > SESSION_GAP_MS) return fallback;
  let start = sorted[0].ended_at - sorted[0].duration * 1000;
  for (const m of sorted.slice(1)) {
    if (start - m.ended_at > SESSION_GAP_MS) break;
    start = m.ended_at - m.duration * 1000;
  }
  return Math.min(start, fallback);
}

export function sessionMatches(matches: MatchLite[], start: number): MatchLite[] {
  return matches.filter((m) => m.ended_at >= start);
}

export const PRAISE_TIPS = [
  "Отметь лучший момент тиммейта в чате — «nice save», «good ward» работают лучше, чем кажется.",
  "Похвали саппорта за варды и сейвы — его работу редко замечают.",
  "Найди, что тиммейт сделал хорошо, и скажи об этом. Это бесплатно и поднимает настроение всей пачке.",
  "Даже после поражения — «gg, well played» тому, кто старался. Хорошая карма для следующей игры.",
];

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}

export function streakMessage(streak: number, warnAt: number): TiltMessage | null {
  if (streak < warnAt) return null;
  const word = plural(streak, "поражение", "поражения", "поражений");
  return streak > warnAt
    ? {
        kind: "streak",
        level: "warn",
        text: `${streak} ${word} подряд. Серьёзно, сделай перерыв минут на 15–20: вода, разминка, свежий воздух. Рейтинг никуда не денется.`,
      }
    : {
        kind: "streak",
        level: "info",
        text: `${streak} ${word} подряд — может, пять минут перерыва перед следующей?`,
      };
}

export function sessionMessage(minutes: number, warnAt: number): TiltMessage | null {
  if (minutes < warnAt) return null;
  return {
    kind: "session",
    level: minutes >= warnAt * 1.5 ? "warn" : "info",
    text: `Ты играешь уже ${formatDuration(minutes)}. Хороший момент встать и размяться.`,
  };
}

/** Messages to show after a match ends. `praiseIndex` makes the tip deterministic in tests. */
export function postMatchMessages(
  matches: MatchLite[],
  now: number,
  appStartedAt: number,
  settings: TiltSettings,
  praiseIndex = Math.floor(Math.random() * PRAISE_TIPS.length),
): TiltMessage[] {
  const out: TiltMessage[] = [];
  const streak = streakMessage(lossStreak(matches), settings.lossStreakWarn);
  if (streak) out.push(streak);
  const minutes = (now - sessionStart(matches, now, appStartedAt)) / 60_000;
  const session = sessionMessage(minutes, settings.sessionWarnMinutes);
  if (session) out.push(session);
  if (settings.praiseReminder) {
    out.push({ kind: "praise", level: "info", text: PRAISE_TIPS[praiseIndex % PRAISE_TIPS.length] });
  }
  return out;
}
