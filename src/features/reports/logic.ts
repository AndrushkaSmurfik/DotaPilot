// Report reminders. DotaPilot can't read chat (GSI doesn't expose it) and never
// touches the report system: the player marks toxic moments with a hotkey and
// gets a reminder with manual steps after the match.

import { formatClock } from "../timers/logic";
import type { TiltMessage } from "../tilt/logic";

export interface ToxicMark {
  id: number;
  match_id: string;
  clock: number;
  created_at: number;
  reported: number;
}

export const REPORT_STEPS = [
  "В таблице счёта после матча (или в истории матчей Dota) нажмите на игрока.",
  "Выберите «Пожаловаться» и подходящую причину: «Оскорбления в чате», «Голосовой чат» или «Намеренный слив».",
  "Отправьте жалобу. Это делаете только вы — DotaPilot ничего не нажимает за вас.",
];

export function formatMarkTimes(marks: Pick<ToxicMark, "clock">[]): string {
  return [...marks]
    .sort((a, b) => a.clock - b.clock)
    .map((m) => formatClock(m.clock))
    .join(", ");
}

export function reportReminder(marks: Pick<ToxicMark, "clock" | "reported">[]): TiltMessage | null {
  const pending = marks.filter((m) => !m.reported);
  if (!pending.length) return null;
  return {
    kind: "report",
    level: "info",
    text: `Ты отметил токсичное поведение (${formatMarkTimes(pending)}). Не забудь отправить репорт вручную: таблица счёта → игрок → «Пожаловаться».`,
  };
}
