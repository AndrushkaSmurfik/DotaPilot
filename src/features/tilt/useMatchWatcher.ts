import { useEffect, useRef } from "react";
import { emit } from "@tauri-apps/api/event";
import { useGsi } from "../../shared/gsi/store";
import { GameRules } from "../../shared/gsi/types";
import { recentMatches, recordMatch, toxicMarks } from "../../shared/db";
import { notify } from "../../shared/notify";
import { reportReminder } from "../reports/logic";
import { OVERLAY_NOTICE_EVENT, type OverlayNotice } from "../../overlay/events";
import type { PostMatchTarget } from "../postmatch/usePostMatch";
import { useSettings } from "../settings/store";
import { postMatchMessages, type TiltMessage } from "./logic";

export const APP_STARTED_AT = Date.now();

/**
 * Watches GSI for the transition into POST_GAME: stores the result, computes
 * anti-tilt messages and hands the match to the post-match screen.
 */
export function useMatchWatcher(onMatchEnd: (target: PostMatchTarget, messages: TiltMessage[]) => void) {
  const state = useGsi((s) => s.state);
  const prev = useGsi((s) => s.prev);
  const handled = useRef(new Set<string>());
  const cb = useRef(onMatchEnd);
  cb.current = onMatchEnd;

  useEffect(() => {
    const map = state?.map;
    const matchId = map?.matchid;
    if (map?.game_state !== GameRules.PostGame || prev?.map?.game_state === GameRules.PostGame) return;
    if (!matchId || matchId === "0" || handled.current.has(matchId)) return;
    handled.current.add(matchId);

    const team = state?.player?.team_name;
    const won = Boolean(team && map.win_team === team);
    (async () => {
      await recordMatch({
        match_id: matchId,
        hero_id: state?.hero?.id ?? null,
        hero_name: state?.hero?.name ?? null,
        won: won ? 1 : 0,
        ended_at: Date.now(),
        duration: Math.max(0, map.clock_time ?? 0),
      });
      const settings = useSettings.getState().settings!;
      const messages = postMatchMessages(await recentMatches(), Date.now(), APP_STARTED_AT, settings.tilt);
      const report = reportReminder(await toxicMarks(matchId));
      if (report) messages.unshift(report);
      for (const m of messages) {
        await emit<OverlayNotice>(OVERLAY_NOTICE_EVENT, { text: m.text, ttl: 20 });
      }
      if (settings.systemNotifications) {
        for (const m of messages.filter((x) => x.kind !== "praise")) {
          await notify(m.kind === "report" ? "DotaPilot: репорт" : "DotaPilot", m.text);
        }
      }
      cb.current(
        { matchId, accountId: state?.player?.accountid ?? null, heroId: state?.hero?.id ?? null },
        messages,
      );
    })();
  }, [state, prev]);
}
