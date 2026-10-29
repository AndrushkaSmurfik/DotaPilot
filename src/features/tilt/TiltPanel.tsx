import { useEffect, useState } from "react";
import { recentMatches, type MatchRecord } from "../../shared/db";
import { Card } from "../../shared/ui";
import { useSettings } from "../settings/store";
import {
  formatDuration,
  lossStreak,
  sessionMatches,
  sessionMessage,
  sessionStart,
  type TiltMessage,
} from "./logic";
import { APP_STARTED_AT } from "./useMatchWatcher";

export function TiltPanel({ messages, refreshKey }: { messages: TiltMessage[]; refreshKey: unknown }) {
  const settings = useSettings((s) => s.settings)!;
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    recentMatches().then(setMatches);
  }, [refreshKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const start = sessionStart(matches, now, APP_STARTED_AT);
  const minutes = (now - start) / 60_000;
  const inSession = sessionMatches(matches, start);
  const wins = inSession.filter((m) => m.won).length;
  const streak = lossStreak(matches);
  const live = sessionMessage(minutes, settings.tilt.sessionWarnMinutes);
  const shown = [...messages.filter((m) => m.kind !== "session"), ...(live ? [live] : [])];

  return (
    <Card title="Сессия">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="tabular text-xl font-semibold">{formatDuration(minutes)}</div>
          <div className="text-xs text-zinc-400">в игре</div>
        </div>
        <div>
          <div className="tabular text-xl font-semibold">
            <span className="text-radiant">{wins}</span>–<span className="text-dire">{inSession.length - wins}</span>
          </div>
          <div className="text-xs text-zinc-400">за сессию</div>
        </div>
        <div>
          <div className={`tabular text-xl font-semibold ${streak >= settings.tilt.lossStreakWarn ? "text-dire" : ""}`}>
            {streak}
          </div>
          <div className="text-xs text-zinc-400">поражений подряд</div>
        </div>
      </div>
      {shown.length > 0 && (
        <ul className="mt-4 space-y-2">
          {shown.map((m) => (
            <li
              key={m.kind}
              className={`rounded-md px-3 py-2 text-sm ${
                m.level === "warn" ? "bg-amber-950 text-amber-200" : "bg-sky-950 text-sky-100"
              }`}
            >
              {m.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
