// Mirrors src-tauri/src/gsi/types.rs (auth is stripped before it reaches the UI).

export interface GsiMap {
  name?: string;
  matchid?: string;
  game_time?: number;
  clock_time?: number;
  daytime?: boolean;
  nightstalker_night?: boolean;
  game_state?: string;
  paused?: boolean;
  win_team?: string;
  radiant_score?: number;
  dire_score?: number;
}

export interface GsiPlayer {
  steamid?: string;
  accountid?: string;
  name?: string;
  activity?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  last_hits?: number;
  denies?: number;
  team_name?: string;
  gold?: number;
  gpm?: number;
  xpm?: number;
}

export interface GsiHero {
  id?: number;
  name?: string;
  level?: number;
  alive?: boolean;
  respawn_seconds?: number;
  buyback_cost?: number;
  buyback_cooldown?: number;
}

export interface GameState {
  provider?: { name?: string; appid?: number; version?: number; timestamp?: number };
  map?: GsiMap | null;
  player?: GsiPlayer | null;
  hero?: GsiHero | null;
}

export const GSI_STATE_EVENT = "gsi://state";

export const GameRules = {
  PreGame: "DOTA_GAMERULES_STATE_PRE_GAME",
  InProgress: "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS",
  PostGame: "DOTA_GAMERULES_STATE_POST_GAME",
} as const;
