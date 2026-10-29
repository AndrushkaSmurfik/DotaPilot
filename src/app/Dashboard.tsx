import { useEffect, useState } from "react";
import { isConnected, useGsi } from "../shared/gsi/store";
import { Card } from "../shared/ui";
import { useSettings } from "../features/settings/store";
import { computeTimers, formatClock } from "../features/timers/logic";
import { TimerList, builtinRows } from "../features/timers/TimerList";
import { TiltPanel } from "../features/tilt/TiltPanel";
import type { TiltMessage } from "../features/tilt/logic";
import { heroLabel } from "../features/history/logic";


export function Dashboard({ tiltMessages, refreshKey }: { tiltMessages: TiltMessage[]; refreshKey: unknown }) {
  const { settings, serverError } = useSettings();
  const { state, receivedAt } = useGsi();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  const s = settings!;
  const connected = isConnected(receivedAt, now);
  const clock = state?.map?.clock_time;
  const p = state?.player;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Подключение">
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-radiant" : "bg-zinc-600"}`} />
          {connected ? "Dota 2 передаёт данные" : "Нет данных от игры"}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          GSI-сервер: 127.0.0.1:{s.gsiPort}
          {receivedAt && ` · последний пакет ${Math.round((now - receivedAt) / 1000)} с назад`}
        </p>
        {serverError && <p className="mt-2 text-sm text-red-400">{serverError}</p>}
        {!connected && (
          <p className="mt-3 text-xs text-zinc-400">
            Без игры: <code className="text-gold">npm run mock:gsi</code> — мок-скрипт пришлёт записанные состояния матча.
          </p>
        )}
      </Card>

      <Card title="Текущий матч">
        {clock === undefined ? (
          <p className="text-sm text-zinc-400">Матч не идёт.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{heroLabel(state?.hero?.name)}</span>
              <span className="tabular">{formatClock(clock)}</span>
            </div>
            <div className="tabular text-sm text-zinc-300">
              KDA {p?.kills ?? 0}/{p?.deaths ?? 0}/{p?.assists ?? 0} · LH {p?.last_hits ?? 0} · GPM {p?.gpm ?? 0} · XPM{" "}
              {p?.xpm ?? 0}
            </div>
            <TimerList rows={builtinRows(computeTimers(clock, s.timers, {}), s.timers)} max={4} />
          </div>
        )}
      </Card>

      <div className="lg:col-span-2">
        <TiltPanel messages={tiltMessages} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
