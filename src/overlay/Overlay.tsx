import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { emit, listen } from "@tauri-apps/api/event";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { connectGsi, useGsi } from "../shared/gsi/store";
import { GameRules } from "../shared/gsi/types";
import { addToxicMark, loadSettings, onSettingsChanged, saveSettings } from "../shared/db";
import { speak } from "../shared/speech";
import { logToTerminal } from "../shared/log";
import { buybackStatus } from "../features/timers/buyback";
import type { AppSettings } from "../features/settings/model";
import type { ManualMarks } from "../features/timers/config";
import { computeTimers, dueAlerts, formatClock, isDay } from "../features/timers/logic";
import { TimerList, builtinRows, customRows, sortRows } from "../features/timers/TimerList";
import { newId, pruneFinished, remaining, runAlerts, startRun, type RunningTimer } from "../features/custom/model";
import { duplicateHotkeys, prettyHotkey } from "../features/custom/hotkey";
import { PATCH } from "../features/timers/config";
import {
  BUILTIN,
  applyMark,
  clearMark,
  glyphNotice,
  TIMERS_COMMAND_EVENT,
  TIMERS_STATE_EVENT,
  type BuiltinKey,
  type TimersCommand,
  type TimersState,
} from "../features/custom/events";
import { OVERLAY_NOTICE_EVENT, OVERLAY_SETUP_EVENT, type OverlayNotice } from "./events";

const win = getCurrentWindow();

// Register/unregister calls are async; running them one after another prevents
// a re-render from registering while the previous cleanup is still unregistering.
let hotkeyQueue: Promise<unknown> = Promise.resolve();
const serialHotkeys = <T,>(fn: () => Promise<T>) => {
  const next = hotkeyQueue.then(fn, fn);
  hotkeyQueue = next.catch(() => undefined);
  return next;
};
let hotkeyGeneration = 0;

export function Overlay() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [marks, setMarks] = useState<ManualMarks>({});
  const [runs, setRuns] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<OverlayNotice | null>(null);
  const [toxicCount, setToxicCount] = useState(0);
  const gsi = useGsi((s) => s.state);
  const clock = gsi?.map?.clock_time;
  const matchId = gsi?.map?.matchid;

  // Latest values for hotkey/event callbacks registered once.
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const matchIdRef = useRef(matchId);
  matchIdRef.current = matchId;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const stateRef = useRef<TimersState>({ marks, runs });
  stateRef.current = { marks, runs };
  const prevClock = useRef<number | undefined>(undefined);
  const prevRemaining = useRef(new Map<string, number>());

  const actions = useMemo(() => {
    const markBuiltin = (key: BuiltinKey) => {
      const c = clockRef.current;
      if (c === undefined) {
        setNotice({ text: "Нет данных из игры — таймер по игровому времени не запустить", ttl: 4 });
        return;
      }
      const next = applyMark(stateRef.current.marks, key, c);
      setMarks(next);
      const charges = settingsRef.current?.enemyGlyphCharges ?? 1;
      const text =
        key === "glyph"
          ? glyphNotice({ ...next, glyphCharges: charges }, c, PATCH.glyph.cooldown)
          : BUILTIN[key].notice;
      setNotice({ text, ttl: 3 });
    };
    const startCustom = (defId: string) => {
      const def = settingsRef.current?.customTimers.find((d) => d.id === defId);
      if (!def) return;
      setRuns((rs) => [...rs, startRun(def, clockRef.current, Date.now(), newId())]);
      setNotice({ text: `${def.name} — ${formatClock(def.duration)}`, ttl: 3 });
    };
    const markToxic = async () => {
      const c = clockRef.current;
      const id = matchIdRef.current;
      if (c === undefined || !id) {
        setNotice({ text: "Нет данных из игры", ttl: 3 });
        return;
      }
      await addToxicMark(id, c);
      setToxicCount((n) => n + 1);
      setNotice({ text: `Отмечено (${formatClock(c)}) — напомню о репорте после матча`, ttl: 4 });
    };
    const resetAll = () => {
      setMarks({});
      setRuns([]);
      setNotice({ text: "Ручные таймеры сброшены", ttl: 2 });
    };
    return { markBuiltin, startCustom, markToxic, resetAll };
  }, []);

  // Settings, GSI, cross-window events.
  useEffect(() => {
    loadSettings().then(setSettings);
    const unsubs = [
      connectGsi(),
      onSettingsChanged(setSettings),
      listen(OVERLAY_SETUP_EVENT, () => setSetupMode((m) => !m)),
      listen<OverlayNotice>(OVERLAY_NOTICE_EVENT, (e) => setNotice(e.payload)),
      listen<TimersCommand>(TIMERS_COMMAND_EVENT, ({ payload: cmd }) => {
        switch (cmd.type) {
          case "start":
            return actions.startCustom(cmd.defId);
          case "mark":
            return actions.markBuiltin(cmd.key);
          case "clear":
            return setMarks((m) => clearMark(m, cmd.key));
          case "stop":
            return setRuns((rs) => rs.filter((r) => r.runId !== cmd.runId));
          case "request":
            return emit<TimersState>(TIMERS_STATE_EVENT, stateRef.current);
        }
      }),
    ];
    return () => unsubs.forEach((p) => p.then((f) => f()));
  }, [actions]);

  // Mirror running timers to the main window.
  useEffect(() => {
    emit<TimersState>(TIMERS_STATE_EVENT, { marks, runs });
  }, [marks, runs]);

  // Custom timers tick on wall time too.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Restore position / visibility.
  useEffect(() => {
    if (!settings) return;
    win.setPosition(new PhysicalPosition(settings.overlay.x, settings.overlay.y));
    if (settings.overlay.visible) win.show();
    else win.hide();
  }, [settings?.overlay.x, settings?.overlay.y, settings?.overlay.visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click-through except in setup mode; persist position after dragging.
  useEffect(() => {
    win.setIgnoreCursorEvents(!setupMode);
    if (!setupMode) return;
    let timer: ReturnType<typeof setTimeout>;
    const unlisten = win.onMoved(({ payload }) => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const fresh = await loadSettings();
        await saveSettings({ ...fresh, overlay: { ...fresh.overlay, x: payload.x, y: payload.y } });
      }, 400);
    });
    return () => {
      clearTimeout(timer);
      unlisten.then((f) => f());
    };
  }, [setupMode]);

  // A new match drops marks and in-game custom timers.
  useEffect(() => {
    setMarks({});
    setToxicCount(0);
    setRuns((rs) => rs.filter((r) => r.startClock === null));
  }, [matchId]);

  // Global hotkeys: only start DotaPilot timers, never send input anywhere.
  useEffect(() => {
    if (!settings) return;
    const hk = settings.hotkeys;
    const bindings: [string, string, () => void][] = [
      [hk.roshan, "Рошан", () => actions.markBuiltin("roshan")],
      [hk.glyph, "Глиф", () => actions.markBuiltin("glyph")],
      [hk.tormentor, "Тормент", () => actions.markBuiltin("tormentor")],
      [hk.toxic, "Токсик", actions.markToxic],
      [hk.setupMode, "Настройка оверлея", () => setSetupMode((m) => !m)],
      [hk.resetManual, "Сброс", actions.resetAll],
      ...settings.customTimers
        .filter((d) => d.hotkey)
        .map((d): [string, string, () => void] => [d.hotkey, d.name, () => actions.startCustom(d.id)]),
    ];
    const dupes = duplicateHotkeys(bindings.map(([k]) => k));
    const generation = ++hotkeyGeneration;
    serialHotkeys(async () => {
      if (generation !== hotkeyGeneration) return;
      await unregisterAll();
      const failed: string[] = [];
      for (const [shortcut, name, fn] of bindings) {
        if (!shortcut || dupes.has(shortcut.toLowerCase())) {
          if (shortcut) failed.push(`${name} (${prettyHotkey(shortcut)} занят другим таймером)`);
          continue;
        }
        try {
          await register(shortcut, (e) => e.state === "Pressed" && fn());
        } catch (err) {
          failed.push(`${name} (${prettyHotkey(shortcut)})`);
          logToTerminal("error", `hotkey ${shortcut}: ${String(err)}`);
        }
      }
      if (failed.length) setNotice({ text: `Хоткеи не назначены: ${failed.join(", ")}`, ttl: 8 });
    });
    return () => {
      serialHotkeys(async () => {
        if (generation === hotkeyGeneration) await unregisterAll();
      });
    };
  }, [settings, actions]);

  // Settings-derived parts of the marks (enemy glyph charges).
  const effectiveMarks = useMemo(
    () => ({ ...marks, glyphCharges: settings?.enemyGlyphCharges ?? 1 }),
    [marks, settings?.enemyGlyphCharges],
  );

  // Voice alerts for built-in timers on each GSI tick.
  useEffect(() => {
    if (clock === undefined || !settings) return;
    const prev = prevClock.current;
    prevClock.current = clock;
    if (prev === undefined || !settings.voice) return;
    for (const a of dueAlerts(prev, clock, settings.timers, effectiveMarks)) speak(a.text, settings.voiceVolume);
  }, [clock, settings, effectiveMarks]);

  // Custom timers: alerts + drop finished ones.
  useEffect(() => {
    const seen = prevRemaining.current;
    for (const id of seen.keys()) if (!runs.some((r) => r.runId === id)) seen.delete(id);
    if (!runs.length) return;
    for (const r of runs) {
      const cur = remaining(r, clock, now);
      const prev = seen.get(r.runId);
      seen.set(r.runId, cur);
      if (prev !== undefined && settings?.voice) {
        for (const text of runAlerts(r, prev, cur)) speak(text, settings.voiceVolume);
      }
    }
    const kept = pruneFinished(runs, clock, now);
    if (kept.length !== runs.length) setRuns(kept);
  }, [now, clock, runs, settings]);

  // Notices fade out.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), (notice.ttl ?? 10) * 1000);
    return () => clearTimeout(t);
  }, [notice]);

  const rows = useMemo(() => {
    if (!settings) return [];
    const builtin =
      clock !== undefined ? builtinRows(computeTimers(clock, settings.timers, effectiveMarks), settings.timers) : [];
    return sortRows([...builtin, ...customRows(runs, clock, now)]);
  }, [clock, settings, effectiveMarks, runs, now]);

  if (!settings) return null;
  const gameState = gsi?.map?.game_state;
  const inGame = clock !== undefined && (gameState === GameRules.PreGame || gameState === GameRules.InProgress);
  const buyback =
    settings.overlay.showBuyback && inGame && clock !== undefined && clock > 0
      ? buybackStatus(gsi?.player?.gold, gsi?.hero?.buyback_cost, gsi?.hero?.buyback_cooldown)
      : null;
  const visibleRows = inGame ? rows : rows.filter((r) => r.custom);

  return (
    <div
      className={`m-1 rounded-lg p-2 text-zinc-100 ${setupMode ? "cursor-move bg-zinc-900/80 ring-2 ring-gold" : ""}`}
      style={{ opacity: settings.overlay.opacity }}
      onMouseDown={(e) => setupMode && e.button === 0 && win.startDragging()}
    >
      {setupMode && (
        <div className="mb-2 text-xs text-gold">
          Режим настройки: перетащите окно. Выход — {prettyHotkey(settings.hotkeys.setupMode)}
        </div>
      )}
      {inGame && clock !== undefined && (
        <div className="mb-1 flex items-center justify-between px-1 text-xs text-zinc-300 drop-shadow">
          <span className="tabular font-semibold">{formatClock(clock)}</span>
          <span>
            {toxicCount > 0 && <span className="mr-2 text-red-300">⚑ {toxicCount}</span>}
            {gsi?.map?.paused ? "⏸ пауза" : isDay(clock) ? "☀ день" : "☾ ночь"}
          </span>
        </div>
      )}
      {buyback && (
        <div
          className={`mb-1 rounded px-2 py-1 text-xs ${
            buyback.state === "ready" ? "bg-radiant/30 text-green-100" : "bg-black/40 text-zinc-300"
          }`}
        >
          {buyback.text}
        </div>
      )}
      {visibleRows.length > 0 && <TimerList rows={visibleRows} max={10} />}
      {!inGame && !visibleRows.length && setupMode && <div className="text-sm text-zinc-400">Ожидание игры…</div>}
      {notice && <div className="mt-2 rounded bg-sky-900/80 px-2 py-1 text-xs text-sky-100">{notice.text}</div>}
    </div>
  );
}
