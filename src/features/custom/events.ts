// The overlay owns running timers (it holds the hotkeys and ticks the clock);
// the main window's "Таймеры" tab mirrors them and sends commands.

import type { ManualMarks, TimerId } from "../timers/config";
import { glyphState } from "../timers/glyph";
import { formatClock } from "../timers/logic";
import type { RunningTimer } from "./model";

export const TIMERS_STATE_EVENT = "timers://state";
export const TIMERS_COMMAND_EVENT = "timers://command";

export type BuiltinKey = "roshan" | "glyph" | "tormentor";

export const BUILTIN: Record<BuiltinKey, { button: string; notice: string }> = {
  roshan: { button: "Рошан убит", notice: "Рошан убит — респавн 8:00–11:00, аегис 5:00" },
  glyph: { button: "Враг нажал глиф", notice: "Глиф врага — откат 5:00" },
  tormentor: { button: "Тормент убит", notice: "Тормент убит — респавн через 10:00" },
};

/** Applies a hotkey/button press at `clock`. Glyph presses accumulate (charges). */
export function applyMark(marks: ManualMarks, key: BuiltinKey, clock: number): ManualMarks {
  switch (key) {
    case "roshan":
      return { ...marks, roshanKilledAt: clock };
    case "tormentor":
      return { ...marks, tormentorKilledAt: clock };
    case "glyph":
      return { ...marks, glyphUses: [...(marks.glyphUses ?? []), clock] };
  }
}

export function clearMark(marks: ManualMarks, key: BuiltinKey): ManualMarks {
  switch (key) {
    case "roshan":
      return { ...marks, roshanKilledAt: undefined };
    case "tormentor":
      return { ...marks, tormentorKilledAt: undefined };
    case "glyph":
      return { ...marks, glyphUses: undefined };
  }
}

/** Overlay message after a glyph press, e.g. "осталось 1 из 2". */
export function glyphNotice(marks: ManualMarks, clock: number, cooldown: number): string {
  const max = Math.max(1, marks.glyphCharges ?? 1);
  if (max === 1) return BUILTIN.glyph.notice;
  const s = glyphState(marks.glyphUses ?? [], clock, max, cooldown);
  const when = s.nextAt === null ? "" : `, следующий через ${formatClock(s.nextAt - clock)}`;
  return `Глиф врага — осталось ${s.charges} из ${max}${when}`;
}

export type TimersCommand =
  | { type: "start"; defId: string }
  | { type: "mark"; key: BuiltinKey }
  | { type: "clear"; key: BuiltinKey }
  | { type: "stop"; runId: string }
  | { type: "request" };

export interface TimersState {
  marks: ManualMarks;
  runs: RunningTimer[];
}

/** Built-in timers that only exist after a hotkey/button press. */
export function isManualActive(id: TimerId, marks: ManualMarks): boolean {
  switch (id) {
    case "roshan":
    case "aegis":
      return marks.roshanKilledAt !== undefined;
    case "glyph":
      return (marks.glyphUses?.length ?? 0) > 0;
    case "tormentor":
      return marks.tormentorKilledAt !== undefined;
    default:
      return false;
  }
}
