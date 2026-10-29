import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import match from "../../../fixtures/opendota-match.json";
import benchmarks from "../../../fixtures/opendota-benchmarks.json";
import { findPlayer, itemTimings, median, pickPlayer, summarize } from "./analysis";
import { fetchMatch, type OdBenchmarks, type OdMatch } from "./opendota";
import { PostMatchCard } from "./PostMatchCard";

// Real OpenDota match 9065883621 (trimmed), player = Lone Druid, account 124801257.
const m = match as unknown as OdMatch;
const b = benchmarks as unknown as OdBenchmarks;

describe("analysis", () => {
  it("finds the player by account id, falling back to hero id", () => {
    expect(findPlayer(m, { accountId: "124801257" })?.hero_id).toBe(80);
    expect(findPlayer(m, { accountId: "1", heroId: 80 })?.account_id).toBe(124801257);
    expect(findPlayer(m, { accountId: "1", heroId: 9999 })).toBeNull();
  });

  it("pickPlayer falls back to the first player for someone else's match", () => {
    expect(pickPlayer(m, { accountId: null, heroId: null })).toBe(m.players[0]);
    expect(pickPlayer(m, { accountId: "1" })).toBe(m.players[0]);
    expect(pickPlayer(m, { heroId: m.players[5].hero_id })).toBe(m.players[5]);
  });

  it("summarizes a real parsed match", () => {
    const s = summarize(m, findPlayer(m, { accountId: 124801257 })!, b);
    expect(s).toMatchObject({
      matchId: "9065883621",
      won: false,
      kills: 0,
      deaths: 2,
      assists: 1,
      gpm: 503,
      lh10: 43,
      parsed: true,
    });
    expect(s.bench?.gpm).toBe(620);
    expect(s.items[0]).toMatchObject({ key: "boots_of_elves", time: 116 });
    expect(s.items.some((i) => i.key === "tango")).toBe(false);
  });

  it("median picks the 50th percentile", () => {
    expect(median([{ percentile: 0.4, value: 1 }, { percentile: 0.5, value: 2 }])).toBe(2);
    expect(median(undefined)).toBeNull();
  });

  it("itemTimings skips consumables, recipes, pre-horn and repeats", () => {
    expect(
      itemTimings([
        { time: -80, key: "boots" },
        { time: 100, key: "tango" },
        { time: 200, key: "recipe_bracer" },
        { time: 300, key: "boots" },
        { time: 400, key: "boots" },
      ]),
    ).toEqual([{ key: "boots", name: "Boots", time: 300 }]);
  });
});

describe("fetchMatch", () => {
  it("returns null on 404 and throws on server errors", async () => {
    const f404 = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    expect(await fetchMatch("1", f404)).toBeNull();
    const f500 = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    await expect(fetchMatch("1", f500)).rejects.toThrow("500");
  });
});

describe("PostMatchCard", () => {
  it("renders KDA, benchmarks and item timings", () => {
    const s = summarize(m, findPlayer(m, { accountId: 124801257 })!, b);
    render(<PostMatchCard summary={s} heroName="Lone Druid" />);
    expect(screen.getByText("Поражение")).toBeTruthy();
    expect(screen.getByText("0/2/1")).toBeTruthy();
    const gpm = within(screen.getByTestId("stat-GPM"));
    expect(gpm.getByText("503")).toBeTruthy();
    expect(gpm.getByText("-19%")).toBeTruthy();
    expect(within(screen.getByTestId("stat-LH@10")).getByText("43")).toBeTruthy();
    expect(screen.getByText("Boots Of Elves")).toBeTruthy();
  });
});
