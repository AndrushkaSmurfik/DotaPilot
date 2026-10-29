import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { loadSettings, saveSettings } from "../../shared/db";
import { logToTerminal } from "../../shared/log";
import { generateToken, type AppSettings } from "./model";

interface SettingsStore {
  settings: AppSettings | null;
  serverError: string | null;
  init: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  startServer: () => Promise<void>;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: null,
  serverError: null,

  init: async () => {
    let s = await loadSettings();
    if (!s.gsiToken) {
      s = { ...s, gsiToken: generateToken() };
      await saveSettings(s);
    }
    set({ settings: s });
    await get().startServer();
  },

  update: async (patch) => {
    const next = { ...get().settings!, ...patch };
    set({ settings: next });
    await saveSettings(next);
    return next;
  },

  startServer: async () => {
    const s = get().settings;
    if (!s) return;
    try {
      await invoke("gsi_start", { port: s.gsiPort, token: s.gsiToken });
      set({ serverError: null });
      logToTerminal("info", `GSI server on 127.0.0.1:${s.gsiPort}`);
    } catch (e) {
      set({ serverError: String(e) });
      logToTerminal("error", `gsi_start failed: ${String(e)}`);
    }
  },
}));

/** Rewrites the GSI cfg in the Dota folder (after port/token change). */
export async function installGsiConfig(s: AppSettings, dotaPath = s.dotaPath): Promise<string> {
  if (!dotaPath) throw new Error("Папка Dota 2 не выбрана");
  const res = await invoke<{ path: string }>("install_gsi_config", {
    dotaPath,
    port: s.gsiPort,
    token: s.gsiToken,
  });
  return res.path;
}
