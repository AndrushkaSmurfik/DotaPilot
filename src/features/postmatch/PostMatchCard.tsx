import { formatClock } from "../timers/logic";
import { delta, type PostMatchSummary } from "./analysis";

function Compare({ label, value, bench }: { label: string; value: number | null; bench?: number }) {
  const d = value !== null && bench ? delta(value, bench) : null;
  return (
    <div className="rounded-lg bg-zinc-800/70 p-3" data-testid={`stat-${label}`}>
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="tabular text-2xl font-semibold">{value ?? "—"}</div>
      {bench !== undefined && (
        <div className="text-xs text-zinc-400">
          медиана героя {bench}
          {d !== null && (
            <span className={`ml-1 font-semibold ${d >= 0 ? "text-radiant" : "text-dire"}`}>
              {d >= 0 ? "+" : ""}
              {Math.round(d * 100)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PostMatchCard({ summary, heroName }: { summary: PostMatchSummary; heroName?: string }) {
  const s = summary;
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            <span className={s.won ? "text-radiant" : "text-dire"}>{s.won ? "Победа" : "Поражение"}</span>
            {heroName && <span className="text-zinc-300"> · {heroName}</span>}
          </h2>
          <div className="text-sm text-zinc-400">
            Матч {s.matchId} · {formatClock(s.duration)}
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-2xl font-semibold">
            {s.kills}/{s.deaths}/{s.assists}
          </div>
          <div className="text-xs text-zinc-400">KDA {s.kdaRatio}</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Compare label="GPM" value={s.gpm} bench={s.bench?.gpm} />
        <Compare label="XPM" value={s.xpm} bench={s.bench?.xpm} />
        <Compare label="LH@10" value={s.lh10} bench={s.bench?.lh10} />
        <Compare label="Last hits" value={s.lastHits} />
      </div>

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Тайминги предметов</h3>
        {s.parsed ? (
          <ol className="flex flex-wrap gap-2">
            {s.items.map((i) => (
              <li key={i.key} className="rounded bg-zinc-800 px-2 py-1 text-sm">
                <span className="tabular text-gold">{formatClock(i.time)}</span> {i.name}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-zinc-400">
            Матч ещё не распарсен OpenDota — LH@10 и тайминги появятся после разбора реплея.
          </p>
        )}
      </section>
    </article>
  );
}
