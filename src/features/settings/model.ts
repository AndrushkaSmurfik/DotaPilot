import { DEFAULT_TIMER_SETTINGS, type TimerId, type TimerSettings } from "../timers/config";
import type { CustomTimerDef } from "../custom/model";

export interface Hotkeys {
  roshan: string;
  glyph: string;
  tormentor: string;
  toxic: string;
  setupMode: string;
  resetManual: string;
}

export interface AppSettings {
  onboarded: boolean;
  gsiPort: number;
  gsiToken: string;
  dotaPath: string | null;
  voice: boolean;
  voiceVolume: number;
  timers: Record<TimerId, TimerSettings>;
  hotkeys: Hotkeys;
  customTimers: CustomTimerDef[];
  /** Glyph charges the enemy team has (1 normally, 2 in some modes/patches). */
  enemyGlyphCharges: number;
  overlay: { x: number; y: number; opacity: number; visible: boolean; showBuyback: boolean };
  tilt: { lossStreakWarn: number; sessionWarnMinutes: number; praiseReminder: boolean };
  /** Windows toast notifications for post-match reminders. */
  systemNotifications: boolean;
  isPro: boolean;
  aiProxyUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  gsiPort: 3000,
  gsiToken: "",
  dotaPath: null,
  voice: true,
  voiceVolume: 0.9,
  timers: DEFAULT_TIMER_SETTINGS,
  hotkeys: {
    roshan: "Alt+R",
    glyph: "Alt+G",
    tormentor: "Alt+M",
    toxic: "Alt+T",
    setupMode: "CommandOrControl+Alt+O",
    resetManual: "CommandOrControl+Alt+Backspace",
  },
  customTimers: [],
  enemyGlyphCharges: 1,
  overlay: { x: 24, y: 220, opacity: 0.92, visible: true, showBuyback: true },
  tilt: { lossStreakWarn: 2, sessionWarnMinutes: 150, praiseReminder: true },
  systemNotifications: true,
  isPro: false,
  aiProxyUrl: "http://127.0.0.1:8787/review",
};

/** Defaults of earlier versions; untouched ones move to the new defaults. */
const LEGACY_HOTKEYS: Partial<Hotkeys> = {
  roshan: "CommandOrControl+Alt+R",
  glyph: "CommandOrControl+Alt+G",
  tormentor: "CommandOrControl+Alt+M",
  toxic: "CommandOrControl+Alt+T",
};

function migrateHotkeys(stored: Partial<Hotkeys> | undefined): Hotkeys {
  const merged = { ...DEFAULT_SETTINGS.hotkeys, ...stored };
  for (const [k, legacy] of Object.entries(LEGACY_HOTKEYS) as [keyof Hotkeys, string][]) {
    if (merged[k] === legacy) merged[k] = DEFAULT_SETTINGS.hotkeys[k];
  }
  return merged;
}

/** Deep-merges stored settings over defaults so new fields get default values. */
export function mergeSettings(stored: Partial<AppSettings> | null | undefined): AppSettings {
  const s = stored ?? {};
  const timers = { ...DEFAULT_SETTINGS.timers };
  for (const id of Object.keys(timers) as TimerId[]) {
    timers[id] = { ...timers[id], ...s.timers?.[id] };
  }
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    timers,
    hotkeys: migrateHotkeys(s.hotkeys),
    customTimers: Array.isArray(s.customTimers) ? s.customTimers : [],
    overlay: { ...DEFAULT_SETTINGS.overlay, ...s.overlay },
    tilt: { ...DEFAULT_SETTINGS.tilt, ...s.tilt },
  };
}

export function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}
