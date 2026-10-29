// Public OpenDota API client (no key required for these endpoints).

export const OPENDOTA = "https://api.opendota.com/api";

export interface OdPurchase {
  time: number;
  key: string;
}

export interface OdPlayer {
  account_id: number | null;
  player_slot: number;
  hero_id: number;
  personaname?: string;
  isRadiant: boolean;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gold_per_min: number;
  xp_per_min: number;
  hero_damage?: number;
  net_worth?: number;
  /** Cumulative last hits per minute — only present in parsed matches. */
  lh_t?: number[] | null;
  purchase_log?: OdPurchase[] | null;
}

export interface OdMatch {
  match_id: number;
  duration: number;
  radiant_win: boolean;
  start_time: number;
  players: OdPlayer[];
}

export interface OdBenchmarkPoint {
  percentile: number;
  value: number;
}

export interface OdBenchmarks {
  hero_id: number;
  result: Record<string, OdBenchmarkPoint[]>;
}

type Fetch = typeof fetch;

export async function fetchMatch(matchId: string, f: Fetch = fetch): Promise<OdMatch | null> {
  const res = await f(`${OPENDOTA}/matches/${encodeURIComponent(matchId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenDota ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.players) ? (json as OdMatch) : null;
}

/** Asks OpenDota to parse the replay (needed for lh_t / purchase_log). */
export async function requestParse(matchId: string, f: Fetch = fetch): Promise<void> {
  await f(`${OPENDOTA}/request/${encodeURIComponent(matchId)}`, { method: "POST" });
}

export async function fetchBenchmarks(heroId: number, f: Fetch = fetch): Promise<OdBenchmarks | null> {
  const res = await f(`${OPENDOTA}/benchmarks?hero_id=${heroId}`);
  return res.ok ? ((await res.json()) as OdBenchmarks) : null;
}

let heroNames: Promise<Record<number, string>> | null = null;

export function fetchHeroNames(f: Fetch = fetch): Promise<Record<number, string>> {
  heroNames ??= f(`${OPENDOTA}/heroes`)
    .then((r) => (r.ok ? r.json() : []))
    .then((list: { id: number; localized_name: string }[]) =>
      Object.fromEntries(list.map((h) => [h.id, h.localized_name])),
    )
    .catch(() => {
      heroNames = null;
      return {};
    });
  return heroNames;
}
