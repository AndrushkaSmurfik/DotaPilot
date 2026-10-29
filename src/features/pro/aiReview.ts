// AI match review. The client only talks to our proxy; the Anthropic key lives
// in the proxy's .env and never ships with the app.

import type { PostMatchSummary } from "../postmatch/analysis";

export interface AiReview {
  headline: string;
  strengths: string[];
  mistakes: string[];
  focus: string;
  /** true when produced locally because the proxy was unavailable. */
  mock: boolean;
}

export function mockReview(s: PostMatchSummary): AiReview {
  const strengths: string[] = [];
  const mistakes: string[] = [];
  if (s.bench && s.gpm >= s.bench.gpm) strengths.push(`GPM ${s.gpm} выше медианы героя (${s.bench.gpm}).`);
  else if (s.bench) mistakes.push(`GPM ${s.gpm} ниже медианы героя (${s.bench.gpm}) — ищи больше фарма между драками.`);
  if (s.lh10 !== null && s.bench && s.lh10 < s.bench.lh10) {
    mistakes.push(`LH@10: ${s.lh10} против ${s.bench.lh10} — отработай добивания на лайне в демо-режиме.`);
  } else if (s.lh10 !== null) strengths.push(`Хорошая стадия лайна: ${s.lh10} добиваний к 10:00.`);
  if (s.deaths <= 3) strengths.push(`Всего ${s.deaths} смертей — аккуратная игра.`);
  else mistakes.push(`${s.deaths} смертей — проверяй миникарту перед выходом в незнакомую зону.`);
  return {
    headline: s.won ? "Уверенная игра, есть что закрепить" : "Поражение, но есть понятные точки роста",
    strengths,
    mistakes,
    focus: mistakes[0] ?? "Держи тот же уровень и следи за таймингами ключевых предметов.",
    mock: true,
  };
}

export async function requestAiReview(
  summary: PostMatchSummary,
  proxyUrl: string,
  f: typeof fetch = fetch,
): Promise<AiReview> {
  try {
    const res = await f(proxyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary }),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const json = (await res.json()) as Omit<AiReview, "mock"> & { mock?: boolean };
    return { ...json, mock: json.mock ?? false };
  } catch {
    return mockReview(summary);
  }
}
