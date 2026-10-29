import Database from "@tauri-apps/plugin-sql";
import { emit, listen } from "@tauri-apps/api/event";
import { mergeSettings, type AppSettings } from "../features/settings/model";
import type { ToxicMark } from "../features/reports/logic";

const DB_URL = "sqlite:dotapilot.db";
export const SETTINGS_CHANGED_EVENT = "settings://changed";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  dbPromise ??= Database.load(DB_URL);
  return dbPromise;
}

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>("SELECT value FROM settings WHERE key = 'app'");
  return mergeSettings(rows[0] ? JSON.parse(rows[0].value) : null);
}

/** Persists settings and notifies every window (overlay re-reads them). */
export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ('app', $1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [JSON.stringify(settings)],
  );
  await emit(SETTINGS_CHANGED_EVENT, settings);
}

export function onSettingsChanged(cb: (s: AppSettings) => void): Promise<() => void> {
  return listen<AppSettings>(SETTINGS_CHANGED_EVENT, (e) => cb(mergeSettings(e.payload)));
}

export interface MatchRecord {
  match_id: string;
  hero_id: number | null;
  hero_name: string | null;
  won: number;
  ended_at: number;
  duration: number;
}

export async function recordMatch(m: MatchRecord): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO matches (match_id, hero_id, hero_name, won, ended_at, duration)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(match_id) DO NOTHING`,
    [m.match_id, m.hero_id, m.hero_name, m.won, m.ended_at, m.duration],
  );
}

export async function addToxicMark(matchId: string, clock: number): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO toxic_marks (match_id, clock, created_at) VALUES ($1, $2, $3)", [
    matchId,
    clock,
    Date.now(),
  ]);
}

export async function toxicMarks(matchId: string): Promise<ToxicMark[]> {
  const db = await getDb();
  return db.select<ToxicMark[]>("SELECT * FROM toxic_marks WHERE match_id = $1 ORDER BY clock", [matchId]);
}

export async function setMarksReported(matchId: string, reported: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE toxic_marks SET reported = $1 WHERE match_id = $2", [reported ? 1 : 0, matchId]);
}

export async function recentMatches(limit = 50): Promise<MatchRecord[]> {
  const db = await getDb();
  return db.select<MatchRecord[]>("SELECT * FROM matches ORDER BY ended_at DESC LIMIT $1", [limit]);
}
