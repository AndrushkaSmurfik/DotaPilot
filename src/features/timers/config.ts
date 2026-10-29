// Patch-dependent constants (seconds of map.clock_time). Update here after a game patch.
export const PATCH = {
  bountyRune: { first: 0, interval: 180 },
  powerRune: { first: 360, interval: 120 },
  wisdomRune: { first: 420, interval: 420 },
  lotus: { first: 180, interval: 180 },
  stack: { first: 113, interval: 60 }, // xx:53, camps exist from 1:00
  tormentor: { first: 1200, respawn: 600 },
  dayNight: { phase: 300 }, // 5 min day / 5 min night, day starts at 0:00
  neutralTiers: [300, 900, 1500, 2100, 3600],
  roshan: { respawnMin: 480, respawnMax: 660 },
  aegis: { duration: 300 },
  glyph: { cooldown: 300 },
} as const;

export const TIMER_IDS = [
  "bounty",
  "power",
  "wisdom",
  "lotus",
  "stack",
  "tormentor",
  "daynight",
  "neutrals",
  "roshan",
  "aegis",
  "glyph",
] as const;

export type TimerId = (typeof TIMER_IDS)[number];

export interface TimerSettings {
  enabled: boolean;
  voice: boolean;
  /** Seconds before the event to announce it. */
  lead: number;
}

export const TIMER_LABELS: Record<TimerId, string> = {
  bounty: "Руны богатства",
  power: "Руна силы",
  wisdom: "Руны мудрости",
  lotus: "Лотосы",
  stack: "Стак",
  tormentor: "Тормент",
  daynight: "День / ночь",
  neutrals: "Нейтральные предметы",
  roshan: "Рошан",
  aegis: "Аегис",
  glyph: "Глиф врага",
};

export const DEFAULT_TIMER_SETTINGS: Record<TimerId, TimerSettings> = {
  bounty: { enabled: true, voice: true, lead: 15 },
  power: { enabled: true, voice: true, lead: 15 },
  wisdom: { enabled: true, voice: true, lead: 20 },
  lotus: { enabled: true, voice: false, lead: 10 },
  stack: { enabled: true, voice: false, lead: 5 },
  tormentor: { enabled: true, voice: true, lead: 30 },
  daynight: { enabled: true, voice: false, lead: 10 },
  neutrals: { enabled: true, voice: true, lead: 0 },
  roshan: { enabled: true, voice: true, lead: 30 },
  aegis: { enabled: true, voice: true, lead: 30 },
  glyph: { enabled: true, voice: true, lead: 0 },
};

/** Manual timers started by the user's hotkeys; values are clock_time at press. */
export interface ManualMarks {
  roshanKilledAt?: number;
  /** Every enemy glyph press this match. */
  glyphUses?: number[];
  /** Enemy glyph charges (1 normally). Filled from settings, not by hotkeys. */
  glyphCharges?: number;
  tormentorKilledAt?: number;
}
