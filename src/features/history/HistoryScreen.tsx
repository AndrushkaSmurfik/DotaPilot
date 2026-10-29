import { useEffect, useState } from "react";
import { recentMatches, type MatchRecord } from "../../shared/db";
import { Card } from "../../shared/ui";
import { formatClock } from "../timers/logic";
import type { PostMatchTarget } from "../postmatch/usePostMatch";
import { heroLabel, heroStats, overall } from "./logic";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function HistoryScreen({ onOpen }: { onOpen: (t: PostMatchTarget) => void }) {
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);

  useEffect(() => {
    recentMatches(200).then(setMatches);
  }, []);

  if (!matches) return <p className="text-sm text-zinc-400">Загрузка…</p>;
  if (!matches.length) {
    return (
      <Card title="История матчей">
        <p className="text-sm text-zinc-400">Пока пусто — матчи сохраняются автоматически, когда игра доходит до экрана итогов.</p>
      </Card>
    );
  }

  const total = overall(matches);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card title={`Матчи · ${total.wins}–${total.games - total.wins} (${total.winrate}%)`}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-400">
            <tr>
              <th className="py-1">Дата</th>
              <th>Герой</th>
              <th>Итог</th>
              <th>Длит.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.match_id} className="border-t border-zinc-800">
                <td className="py-1.5 text-zinc-400">{dateFmt.format(m.ended_at)}</td>
                <td>{heroLabel(m.hero_name)}</td>
                <td className={m.won ? "text-radiant" : "text-dire"}>{m.won ? "Победа" : "Поражение"}</td>
                <td className="tabular">{formatClock(m.duration)}</td>
                <td className="text-right">
                  <button
                    className="text-xs text-gold hover:underline"
                    onClick={() => onOpen({ matchId: m.match_id, heroId: m.hero_id })}
                  >
                    Разбор →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="По героям">
        <ul className="space-y-2 text-sm">
          {heroStats(matches).map((h) => (
            <li key={h.hero} className="flex justify-between">
              <span>{h.hero}</span>
              <span className="tabular text-zinc-400">
                {h.games} игр · <span className={h.winrate >= 50 ? "text-radiant" : "text-dire"}>{h.winrate}%</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
