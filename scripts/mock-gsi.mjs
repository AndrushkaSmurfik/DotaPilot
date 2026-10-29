#!/usr/bin/env node
// Mock Dota 2 GSI client: POSTs payloads to the local DotaPilot server so you can
// develop without the game running.
//
//   npm run mock:gsi                       # simulate a match, 10x speed
//   npm run mock:gsi -- --speed 30 --from 5:30 --to 12:00
//   npm run mock:gsi -- fixtures            # replay fixtures/gsi/*.json in order
//   npm run mock:gsi -- bad-token           # check that a wrong token is rejected
//
// Options: --port N, --token T (else DOTAPILOT_TOKEN, else read from the app DB),
//          --speed N (game seconds per real second), --from/--to (mm:ss or seconds),
//          --delay MS (fixtures mode), --match-id ID, --lose / --win (post-game result)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(root, "fixtures", "gsi");

function parseArgs(argv) {
  const opts = { mode: "sim" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) opts.mode = a;
    else if (a === "--win" || a === "--lose") opts.result = a.slice(2);
    else opts[a.slice(2)] = argv[++i];
  }
  return opts;
}

function parseClock(v, fallback) {
  if (v === undefined) return fallback;
  const neg = String(v).startsWith("-");
  const s = String(v).replace("-", "");
  const sec = s.includes(":") ? s.split(":").reduce((acc, p) => acc * 60 + Number(p), 0) : Number(s);
  return neg ? -sec : sec;
}

async function readAppSettings() {
  const dirs = [process.env.APPDATA, process.env.LOCALAPPDATA, join(process.env.HOME ?? "", ".config")]
    .filter(Boolean)
    .map((d) => join(d, "com.dotapilot.app", "dotapilot.db"));
  const dbPath = dirs.find((p) => existsSync(p));
  if (!dbPath) return {};
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare("SELECT value FROM settings WHERE key = 'app'").get();
    db.close();
    return row ? JSON.parse(row.value) : {};
  } catch (e) {
    console.warn(`Не удалось прочитать настройки из ${dbPath}: ${e.message}`);
    return {};
  }
}

const fmt = (s) => `${s < 0 ? "-" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadFixture = (name) => JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));

async function send(url, payload, token) {
  const body = JSON.stringify({ ...payload, auth: { token } });
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
    return res.status;
  } catch (e) {
    return `ERR ${e.cause?.code ?? e.message}`;
  }
}

function simulatedPayload(base, clock, matchId) {
  const p = structuredClone(base);
  const t = Math.max(clock, 0);
  p.provider.timestamp = Math.floor(Date.now() / 1000);
  Object.assign(p.map, {
    matchid: matchId,
    clock_time: clock,
    game_time: clock + 90,
    daytime: clock < 0 || Math.floor(clock / 300) % 2 === 0,
    game_state: clock < 0 ? "DOTA_GAMERULES_STATE_PRE_GAME" : "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS",
  });
  Object.assign(p.player, {
    last_hits: Math.floor(t / 7),
    gpm: t ? Math.round(300 + t / 10) : 0,
    xpm: t ? Math.round(350 + t / 9) : 0,
    gold: 600 + (t * 4) % 3000,
  });
  p.hero.level = Math.min(30, 1 + Math.floor(t / 90));
  p.hero.buyback_cost = Math.round(200 + t * 1.5);
  p.hero.buyback_cooldown = 0;
  return p;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const app = await readAppSettings();
  const port = Number(opts.port ?? app.gsiPort ?? 3000);
  const token = opts.token ?? process.env.DOTAPILOT_TOKEN ?? app.gsiToken;
  const url = `http://127.0.0.1:${port}/`;

  if (!token) {
    console.error("Токен не найден: запустите приложение хотя бы раз или передайте --token / DOTAPILOT_TOKEN.");
    process.exit(1);
  }
  console.log(`→ ${url}  (mode: ${opts.mode})`);

  if (opts.mode === "bad-token") {
    const status = await send(url, loadFixture("02-horn.json"), "definitely-wrong-token-000");
    console.log(`Ответ на неверный токен: ${status} (ожидается 401)`);
    process.exit(status === 401 ? 0 : 1);
  }

  if (opts.mode === "fixtures") {
    const delay = Number(opts.delay ?? 1500);
    for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith(".json")).sort()) {
      const status = await send(url, loadFixture(file), token);
      console.log(`${file}: ${status}`);
      await sleep(delay);
    }
    return;
  }

  const speed = Math.max(1, Number(opts.speed ?? 10));
  const from = parseClock(opts.from, -90);
  const to = parseClock(opts.to, 40 * 60);
  const matchId = opts["match-id"] ?? loadFixture("06-postgame.json").map.matchid;
  const base = loadFixture("02-horn.json");
  const tickMs = Math.max(50, 1000 / speed);
  const step = Math.max(1, Math.round(speed * (tickMs / 1000)));

  for (let clock = from; clock <= to; clock += step) {
    const status = await send(url, simulatedPayload(base, clock, matchId), token);
    if (clock % 30 === 0 || status !== 200) process.stdout.write(`\r${fmt(clock).padStart(6)}  ${status}   `);
    if (status !== 200 && clock === from) console.log("\nСервер не принял запрос — проверьте порт/токен.");
    await sleep(tickMs);
  }

  const post = loadFixture("06-postgame.json");
  post.map.matchid = matchId;
  post.map.clock_time = to;
  if (opts.result) post.map.win_team = opts.result === "win" ? post.player.team_name : "dire";
  console.log(`\nPOST_GAME (${post.map.win_team} win): ${await send(url, post, token)}`);
}

main();
