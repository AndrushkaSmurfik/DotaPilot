// User-defined timers ("Смок", "Мидас", …): named countdowns started by a hotkey
// or a button. They tick on the game clock while a match is running and fall
// back to wall-clock time otherwise (e.g. outside a game).

export interface CustomTimerDef {
  id: string;
  name: string;
  /** seconds */
  duration: number;
  /** Tauri shortcut string, "" = no hotkey. */
  hotkey: string;
  voice: boolean;
  /** Seconds before the end to announce. 0 = only at the end. */
  lead: number;
}

export interface RunningTimer {
  runId: string;
  defId: string;
  name: string;
  duration: number;
  lead: number;
  voice: boolean;
  /** clock_time at start, null if started outside a match. */
  startClock: number | null;
  /** ms since epoch */
  startWall: number;
}

/** Finished timers stay visible as "готово" this many seconds. */
export const FINISHED_GRACE = 10;
export const MAX_DURATION = 2 * 60 * 60;

export function elapsed(run: RunningTimer, clock: number | undefined, now: number): number {
  if (run.startClock !== null && clock !== undefined) return clock - run.startClock;
  return Math.floor((now - run.startWall) / 1000);
}

export function remaining(run: RunningTimer, clock: number | undefined, now: number): number {
  return run.duration - elapsed(run, clock, now);
}

export function startRun(
  def: CustomTimerDef,
  clock: number | undefined,
  now: number,
  runId: string,
): RunningTimer {
  return {
    runId,
    defId: def.id,
    name: def.name,
    duration: def.duration,
    lead: def.lead,
    voice: def.voice,
    startClock: clock ?? null,
    startWall: now,
  };
}

export function pruneFinished(runs: RunningTimer[], clock: number | undefined, now: number): RunningTimer[] {
  return runs.filter((r) => remaining(r, clock, now) > -FINISHED_GRACE);
}

/** Voice lines for a run whose remaining time moved from `prev` to `cur`. */
export function runAlerts(run: Pick<RunningTimer, "name" | "lead" | "voice">, prev: number, cur: number): string[] {
  if (!run.voice || cur >= prev) return [];
  const out: string[] = [];
  if (run.lead > 0 && prev > run.lead && cur <= run.lead) out.push(`${run.name} через ${run.lead} секунд`);
  if (prev > 0 && cur <= 0) out.push(`${run.name} готов`);
  return out;
}

/** "8:00" → 480, "90" → 90, "1:02:00" → 3720; null if invalid. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  const sec = parts.reduce((acc, p) => acc * 60 + p, 0);
  return sec > 0 && sec <= MAX_DURATION ? sec : null;
}

export function validateDef(def: Pick<CustomTimerDef, "name" | "duration" | "lead">): string | null {
  if (!def.name.trim()) return "Введите название";
  if (def.name.trim().length > 40) return "Название длиннее 40 символов";
  if (!(def.duration > 0 && def.duration <= MAX_DURATION)) return "Длительность от 0:01 до 2:00:00";
  if (def.lead < 0 || def.lead >= def.duration) return "Предупреждение должно быть меньше длительности";
  return null;
}

export function newId(): string {
  return crypto.randomUUID();
}
