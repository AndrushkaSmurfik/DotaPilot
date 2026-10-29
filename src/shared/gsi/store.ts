import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { GSI_STATE_EVENT, type GameState } from "./types";

interface GsiStore {
  state: GameState | null;
  prev: GameState | null;
  receivedAt: number | null;
  push: (s: GameState) => void;
}

export const useGsi = create<GsiStore>((set) => ({
  state: null,
  prev: null,
  receivedAt: null,
  push: (s) => set((cur) => ({ prev: cur.state, state: s, receivedAt: Date.now() })),
}));

/** Subscribes this window to GSI events; call once per window. */
export function connectGsi(): Promise<() => void> {
  return listen<GameState>(GSI_STATE_EVENT, (e) => useGsi.getState().push(e.payload));
}

/** Dota sends a heartbeat every 30 s even when idle. */
export function isConnected(receivedAt: number | null, now = Date.now()): boolean {
  return receivedAt !== null && now - receivedAt < 35_000;
}
