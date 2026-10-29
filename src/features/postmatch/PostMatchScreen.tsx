import { useState } from "react";
import { Button, Card, inputClass } from "../../shared/ui";
import { AiReviewPanel } from "../pro/AiReviewPanel";
import { ReportCard } from "../reports/ReportCard";
import { PostMatchCard } from "./PostMatchCard";
import { usePostMatch, type PostMatchTarget } from "./usePostMatch";

interface Props {
  target: PostMatchTarget | null;
  onTarget: (t: PostMatchTarget) => void;
  onOpenPro: () => void;
}

export function PostMatchScreen({ target, onTarget, onOpenPro }: Props) {
  const [input, setInput] = useState(target?.matchId ?? "");
  const state = usePostMatch(target);

  return (
    <div className="space-y-4">
      <Card title="Разбор матча">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = input.trim();
            if (/^\d+$/.test(id)) onTarget({ matchId: id, accountId: target?.accountId, heroId: null });
          }}
        >
          <input
            className={inputClass}
            placeholder="match_id (заполняется автоматически после игры)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit">Загрузить</Button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">Данные: OpenDota (публичный API).</p>
      </Card>

      {target && <ReportCard matchId={target.matchId} />}

      {state.status === "loading" &&<p className="text-sm text-zinc-400">Загружаем матч…</p>}
      {state.status === "waiting" && (
        <p className="text-sm text-zinc-400">
          OpenDota ещё не получила матч — запросили разбор, проверяем каждые 30 с (попытка {state.attempt}).
        </p>
      )}
      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}

      {state.status === "ready" && (
        <>
          {state.match.players.length > 1 && (
            <div className="flex flex-wrap gap-1 text-xs">
              {state.match.players.map((p) => (
                <button
                  key={p.player_slot}
                  className={`rounded px-2 py-1 ${
                    p.hero_id === state.summary.heroId ? "bg-zinc-700" : "bg-zinc-900 hover:bg-zinc-800"
                  } ${p.isRadiant ? "text-radiant" : "text-dire"}`}
                  onClick={() => onTarget({ matchId: state.summary.matchId, accountId: null, heroId: p.hero_id })}
                >
                  {p.personaname ?? `slot ${p.player_slot}`}
                </button>
              ))}
            </div>
          )}
          <PostMatchCard summary={state.summary} heroName={state.heroName} />
          <AiReviewPanel summary={state.summary} onOpenPro={onOpenPro} />
        </>
      )}
    </div>
  );
}
