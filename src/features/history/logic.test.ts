import { describe, expect, it } from "vitest";
import { heroLabel, heroStats, overall, type HistoryMatch } from "./logic";

const m = (hero: string | null, won: number): HistoryMatch => ({
  match_id: String(Math.random()),
  hero_id: null,
  hero_name: hero,
  won,
  ended_at: 0,
  duration: 0,
});

describe("history", () => {
  it("prettifies GSI hero names", () => {
    expect(heroLabel("npc_dota_hero_lone_druid")).toBe("Lone Druid");
    expect(heroLabel(null)).toBe("Неизвестный герой");
  });

  it("aggregates games and winrate per hero, most played first", () => {
    const stats = heroStats([
      m("npc_dota_hero_axe", 1),
      m("npc_dota_hero_lone_druid", 0),
      m("npc_dota_hero_lone_druid", 1),
      m("npc_dota_hero_lone_druid", 1),
    ]);
    expect(stats).toEqual([
      { hero: "Lone Druid", games: 3, wins: 2, winrate: 67 },
      { hero: "Axe", games: 1, wins: 1, winrate: 100 },
    ]);
  });

  it("computes overall winrate", () => {
    expect(overall([m("a", 1), m("b", 0)])).toEqual({ games: 2, wins: 1, winrate: 50 });
    expect(overall([])).toEqual({ games: 0, wins: 0, winrate: 0 });
  });
});
