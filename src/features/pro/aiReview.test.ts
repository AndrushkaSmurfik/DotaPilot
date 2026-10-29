import { describe, expect, it, vi } from "vitest";
import type { PostMatchSummary } from "../postmatch/analysis";
import { mockReview, requestAiReview } from "./aiReview";
import { isPro } from "./flags";
import { formatPrice, yearlySavingPercent } from "./plans";

const summary: PostMatchSummary = {
  matchId: "1",
  heroId: 80,
  won: false,
  duration: 1995,
  kills: 0,
  deaths: 5,
  assists: 1,
  kdaRatio: 0.2,
  gpm: 503,
  xpm: 600,
  lastHits: 290,
  lh10: 43,
  bench: { gpm: 620, xpm: 700, lh10: 60 },
  items: [],
  parsed: true,
};

describe("AI review", () => {
  it("builds a deterministic mock from the summary", () => {
    const r = mockReview(summary);
    expect(r.mock).toBe(true);
    expect(r.mistakes).toHaveLength(3);
    expect(r.focus).toContain("GPM 503");
  });

  it("uses the proxy response when available", async () => {
    const body = { headline: "h", strengths: ["s"], mistakes: [], focus: "f" };
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const r = await requestAiReview(summary, "http://proxy/review", f);
    expect(r).toEqual({ ...body, mock: false });
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ summary });
  });

  it("falls back to the mock when the proxy is down", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect((await requestAiReview(summary, "http://proxy/review", f)).mock).toBe(true);
  });

  it("formats plan prices and yearly saving", () => {
    expect(formatPrice(2390).replace(/\s/g, " ")).toBe("2 390 ₽");
    expect(yearlySavingPercent()).toBe(33);
  });

  it("gates on the isPro flag", () => {
    expect(isPro({ isPro: true })).toBe(true);
    expect(isPro({ isPro: false })).toBe(false);
  });
});
