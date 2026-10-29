export interface HistoryMatch {
  match_id: string;
  hero_id: number | null;
  hero_name: string | null;
  won: number | boolean;
  ended_at: number;
  duration: number;
}

export interface HeroStat {
  hero: string;
  games: number;
  wins: number;
  winrate: number;
}

/** "npc_dota_hero_lone_druid" → "Lone Druid". */
export function heroLabel(name: string | null | undefined): string {
  if (!name) return "Неизвестный герой";
  return name
    .replace(/^npc_dota_hero_/, "")
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function heroStats(matches: HistoryMatch[]): HeroStat[] {
  const byHero = new Map<string, { games: number; wins: number }>();
  for (const m of matches) {
    const hero = heroLabel(m.hero_name);
    const s = byHero.get(hero) ?? { games: 0, wins: 0 };
    s.games++;
    if (m.won) s.wins++;
    byHero.set(hero, s);
  }
  return [...byHero.entries()]
    .map(([hero, s]) => ({ hero, ...s, winrate: Math.round((s.wins / s.games) * 100) }))
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate);
}

export function overall(matches: HistoryMatch[]): { games: number; wins: number; winrate: number } {
  const wins = matches.filter((m) => m.won).length;
  return { games: matches.length, wins, winrate: matches.length ? Math.round((wins / matches.length) * 100) : 0 };
}
