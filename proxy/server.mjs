// AI-review proxy. Holds ANTHROPIC_API_KEY server-side (proxy/.env) so the desktop
// client never contains it. Without a key (or with AI_MOCK=true) it returns a mock.
//
//   npm run proxy        → http://127.0.0.1:8787/review

import { createServer } from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const PORT = Number(process.env.PROXY_PORT ?? 8787);
const MODEL = "claude-opus-5-5";
const USE_MOCK = !process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === "true";
const client = USE_MOCK ? null : new Anthropic();

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "strengths", "mistakes", "focus"],
  properties: {
    headline: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    mistakes: { type: "array", items: { type: "string" } },
    focus: { type: "string" },
  },
};

const SYSTEM = `Ты — тренер по Dota 2. Тебе дают сводку одного матча игрока: KDA, GPM/XPM, добивания к 10-й минуте,
медианы этого героя из публичной статистики OpenDota и тайминги предметов.
Дай короткий честный разбор на русском: headline — одна фраза; strengths — 1–3 конкретных сильных стороны;
mistakes — 1–3 конкретных точки роста с практическим советом; focus — одна задача на следующую игру.
Опирайся только на переданные цифры, не выдумывай события матча. Тон дружелюбный, без токсичности.`;

function mockedReview(summary) {
  const won = Boolean(summary?.won);
  return {
    headline: won ? "Хорошая игра" : "Разбор поражения",
    strengths: [`KDA ${summary?.kills ?? 0}/${summary?.deaths ?? 0}/${summary?.assists ?? 0}`],
    mistakes: summary?.bench && summary.gpm < summary.bench.gpm ? ["Фарм ниже медианы героя"] : [],
    focus: "Демо-ответ: добавьте ANTHROPIC_API_KEY в proxy/.env, чтобы включить настоящий разбор.",
    mock: true,
  };
}

/** Keeps only fields the model needs, so a client can't push arbitrary prompt text. */
function sanitize(summary) {
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    won: Boolean(summary?.won),
    durationSec: num(summary?.duration),
    kills: num(summary?.kills),
    deaths: num(summary?.deaths),
    assists: num(summary?.assists),
    gpm: num(summary?.gpm),
    xpm: num(summary?.xpm),
    lastHits: num(summary?.lastHits),
    lastHitsAt10: num(summary?.lh10),
    heroMedian: summary?.bench
      ? { gpm: num(summary.bench.gpm), xpm: num(summary.bench.xpm), lastHitsAt10: num(summary.bench.lh10) }
      : null,
    itemTimings: Array.isArray(summary?.items)
      ? summary.items.slice(0, 20).map((i) => ({ item: String(i.name).slice(0, 60), timeSec: num(i.time) }))
      : [],
  };
}

async function generateReview(summary) {
  if (USE_MOCK) return mockedReview(summary);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: REVIEW_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(sanitize(summary)) }],
  });
  if (response.stop_reason === "refusal") {
    return { ...mockedReview(summary), focus: "Модель отказалась разбирать этот матч — показан демо-ответ." };
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`empty response (stop_reason=${response.stop_reason})`);
  return { ...JSON.parse(text), mock: false };
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  if (req.method !== "POST" || req.url !== "/review") return send(res, 404, { error: "not found" });
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 64_000) req.destroy();
  });
  req.on("end", async () => {
    let summary;
    try {
      summary = JSON.parse(raw || "{}").summary;
    } catch {
      return send(res, 400, { error: "bad request" });
    }
    try {
      send(res, 200, await generateReview(summary));
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) console.error("Неверный ANTHROPIC_API_KEY");
      else if (e instanceof Anthropic.RateLimitError) console.error("Лимит запросов Anthropic, повторите позже");
      else console.error("Ошибка разбора:", e?.message ?? e);
      send(res, 502, { error: "review failed" });
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`AI proxy on http://127.0.0.1:${PORT}/review (${USE_MOCK ? "mock mode" : `model ${MODEL}`})`);
});
