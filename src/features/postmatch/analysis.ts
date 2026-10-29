import type { OdBenchmarks, OdMatch, OdPlayer, OdPurchase } from "./opendota";

export interface ItemTiming {
  key: string;
  name: string;
  time: number;
}

export interface PostMatchSummary {
  matchId: string;
  heroId: number;
  won: boolean;
  duration: number;
  kills: number;
  deaths: number;
  assists: number;
  kdaRatio: number;
  gpm: number;
  xpm: number;
  lastHits: number;
  /** null when the match isn't parsed yet. */
  lh10: number | null;
  bench: { gpm: number; xpm: number; lh10: number } | null;
  items: ItemTiming[];
  parsed: boolean;
}

/** Consumables and wards clutter the timeline. */
const IGNORED_ITEMS = new Set([
  "tango",
  "tango_single",
  "clarity",
  "flask",
  "enchanted_mango",
  "faerie_fire",
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "dust",
  "smoke_of_deceit",
  "tpscroll",
  "blood_grenade",
  "branches",
  "famango",
  "great_famango",
  "greater_famango",
  "aghanims_shard_roshan",
  "cheese",
  "refresher_shard",
  "aegis",
]);

export function findPlayer(
  match: OdMatch,
  who: { accountId?: string | number | null; heroId?: number | null },
): OdPlayer | null {
  const acc = who.accountId != null ? Number(who.accountId) : null;
  return (
    (acc ? match.players.find((p) => p.account_id === acc) : undefined) ??
    (who.heroId ? match.players.find((p) => p.hero_id === who.heroId) : undefined) ??
    null
  );
}

/** Like findPlayer, but for manual lookups of someone else's match falls back to the first player. */
export function pickPlayer(
  match: OdMatch,
  who: { accountId?: string | number | null; heroId?: number | null },
): OdPlayer | null {
  return findPlayer(match, who) ?? match.players[0] ?? null;
}

export function isParsed(player: OdPlayer): boolean {
  return Array.isArray(player.lh_t) && player.lh_t.length > 0 && Array.isArray(player.purchase_log);
}

export function median(points: { percentile: number; value: number }[] | undefined): number | null {
  if (!points?.length) return null;
  const sorted = [...points].sort(
    (a, b) => Math.abs(a.percentile - 0.5) - Math.abs(b.percentile - 0.5),
  );
  return sorted[0].value;
}

export function prettifyItem(key: string): string {
  return key
    .replace(/^recipe_/, "Рецепт: ")
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** First purchase of each non-consumable item after the horn. */
export function itemTimings(log: OdPurchase[] | null | undefined): ItemTiming[] {
  const seen = new Set<string>();
  const out: ItemTiming[] = [];
  for (const p of [...(log ?? [])].sort((a, b) => a.time - b.time)) {
    if (p.time <= 0 || IGNORED_ITEMS.has(p.key) || p.key.startsWith("recipe_") || seen.has(p.key)) {
      continue;
    }
    seen.add(p.key);
    out.push({ key: p.key, name: prettifyItem(p.key), time: p.time });
  }
  return out;
}

export function summarize(
  match: OdMatch,
  player: OdPlayer,
  benchmarks: OdBenchmarks | null,
): PostMatchSummary {
  const lh10 = player.lh_t && player.lh_t.length > 10 ? player.lh_t[10] : null;
  const r = benchmarks?.result;
  const gpm = median(r?.gold_per_min);
  const xpm = median(r?.xp_per_min);
  const lhpm = median(r?.last_hits_per_min);
  return {
    matchId: String(match.match_id),
    heroId: player.hero_id,
    won: player.isRadiant === match.radiant_win,
    duration: match.duration,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    kdaRatio: Math.round(((player.kills + player.assists) / Math.max(1, player.deaths)) * 10) / 10,
    gpm: player.gold_per_min,
    xpm: player.xp_per_min,
    lastHits: player.last_hits,
    lh10,
    bench:
      gpm !== null && xpm !== null && lhpm !== null
        ? { gpm, xpm, lh10: Math.round(lhpm * 10) }
        : null,
    items: itemTimings(player.purchase_log),
    parsed: isParsed(player),
  };
}

/** Relative difference vs benchmark, e.g. -0.19 for 19% below median. */
export function delta(value: number, bench: number): number {
  return bench ? (value - bench) / bench : 0;
}
