import { formatClock, type TimerView } from "./logic";
import type { TimerId, TimerSettings } from "./config";
import { remaining, type RunningTimer } from "../custom/model";

export interface TimerRow {
  key: string;
  label: string;
  remaining: number;
  soon: boolean;
  custom?: boolean;
}

export function builtinRows(views: TimerView[], settings: Record<TimerId, TimerSettings>): TimerRow[] {
  return views.map((v) => ({
    key: v.id,
    label: v.label,
    remaining: v.remaining,
    soon: v.remaining <= Math.max(settings[v.id].lead, 5),
  }));
}

export function customRows(runs: RunningTimer[], clock: number | undefined, now: number): TimerRow[] {
  return runs.map((r) => {
    const rem = remaining(r, clock, now);
    return { key: r.runId, label: r.name, remaining: rem, soon: rem <= Math.max(r.lead, 5), custom: true };
  });
}

export function sortRows(rows: TimerRow[]): TimerRow[] {
  return [...rows].sort((a, b) => a.remaining - b.remaining);
}

export function TimerList({ rows, max = 8 }: { rows: TimerRow[]; max?: number }) {
  return (
    <ul className="space-y-1">
      {rows.slice(0, max).map((t) => (
        <li
          key={t.key}
          className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
            t.remaining <= 0
              ? "bg-radiant/30 text-green-100"
              : t.soon
                ? "bg-gold/25 text-gold"
                : "bg-black/40 text-zinc-100"
          }`}
        >
          <span className="truncate">
            {t.custom && <span className="mr-1 text-sky-300">◆</span>}
            {t.label}
          </span>
          <span className="tabular ml-3 font-semibold">{t.remaining <= 0 ? "готово" : formatClock(t.remaining)}</span>
        </li>
      ))}
    </ul>
  );
}
