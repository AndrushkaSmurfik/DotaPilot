import { useEffect, useState } from "react";
import { logToTerminal } from "../../shared/log";
import { isParsed, pickPlayer, summarize, type PostMatchSummary } from "./analysis";
import { fetchBenchmarks, fetchHeroNames, fetchMatch, requestParse, type OdMatch } from "./opendota";

export interface PostMatchTarget {
  matchId: string;
  accountId?: string | null;
  heroId?: number | null;
}

export type PostMatchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "waiting"; attempt: number }
  | { status: "ready"; summary: PostMatchSummary; heroName?: string; match: OdMatch; final: boolean }
  | { status: "error"; message: string };

const RETRY_MS = 30_000;
const MAX_ATTEMPTS = 20;

/** Loads a match from OpenDota, asking for a parse and polling until LH@10 data appears. */
export function usePostMatch(target: PostMatchTarget | null): PostMatchState {
  const [state, setState] = useState<PostMatchState>({ status: "idle" });

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let parseRequested = false;

    async function attempt(n: number) {
      try {
        const match = await fetchMatch(target!.matchId);
        if (cancelled) return;
        const player = match && pickPlayer(match, target!);
        if (match && !player) {
          setState({ status: "error", message: "В ответе OpenDota нет игроков" });
          return;
        }
        const parsed = player ? isParsed(player) : false;
        if (!parsed && !parseRequested) {
          parseRequested = true;
          await requestParse(target!.matchId).catch(() => undefined);
        }
        if (match && player) {
          const [bench, heroes] = await Promise.all([fetchBenchmarks(player.hero_id), fetchHeroNames()]);
          if (cancelled) return;
          setState({
            status: "ready",
            summary: summarize(match, player, bench),
            heroName: heroes[player.hero_id],
            match,
            final: parsed,
          });
        } else {
          setState({ status: "waiting", attempt: n });
        }
        if (!parsed && n < MAX_ATTEMPTS) timer = setTimeout(() => attempt(n + 1), RETRY_MS);
      } catch (e) {
        logToTerminal("error", `OpenDota ${target!.matchId}: ${String(e)}`);
        if (!cancelled) setState({ status: "error", message: `Не удалось загрузить матч: ${String(e)}` });
      }
    }

    setState({ status: "loading" });
    attempt(1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [target]);

  return state;
}
