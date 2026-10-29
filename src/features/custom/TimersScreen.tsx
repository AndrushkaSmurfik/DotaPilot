import { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { useGsi } from "../../shared/gsi/store";
import { Button, Card, Field, Toggle, inputClass } from "../../shared/ui";
import { useSettings } from "../settings/store";
import type { Hotkeys } from "../settings/model";
import { computeTimers, formatClock } from "../timers/logic";
import {
  BUILTIN,
  TIMERS_COMMAND_EVENT,
  TIMERS_STATE_EVENT,
  isManualActive,
  type BuiltinKey,
  type TimersCommand,
  type TimersState,
} from "./events";
import { duplicateHotkeys, prettyHotkey } from "./hotkey";
import { HotkeyInput } from "./HotkeyInput";
import { newId, parseDuration, remaining, validateDef, type CustomTimerDef } from "./model";

const send = (cmd: TimersCommand) => emit<TimersCommand>(TIMERS_COMMAND_EVENT, cmd);

const BUILTIN_HOTKEY: Record<BuiltinKey, keyof Hotkeys> = { roshan: "roshan", glyph: "glyph", tormentor: "tormentor" };
const BUILTIN_OF: Partial<Record<string, BuiltinKey>> = {
  roshan: "roshan",
  aegis: "roshan",
  glyph: "glyph",
  tormentor: "tormentor",
};

interface Draft {
  id: string | null;
  name: string;
  duration: string;
  hotkey: string;
  voice: boolean;
  lead: string;
}

const EMPTY: Draft = { id: null, name: "", duration: "", hotkey: "", voice: true, lead: "10" };

export function TimersScreen() {
  const { settings, update } = useSettings();
  const clock = useGsi((s) => s.state?.map?.clock_time);
  const [state, setState] = useState<TimersState>({ marks: {}, runs: [] });
  const [now, setNow] = useState(Date.now());
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const s = settings!;

  useEffect(() => {
    const unlisten = listen<TimersState>(TIMERS_STATE_EVENT, (e) => setState(e.payload));
    send({ type: "request" });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      unlisten.then((f) => f());
    };
  }, []);

  const marks = { ...state.marks, glyphCharges: s.enemyGlyphCharges };
  const builtinRunning =
    clock === undefined ? [] : computeTimers(clock, s.timers, marks).filter((v) => isManualActive(v.id, marks));
  const customRunning = state.runs.map((r) => ({ run: r, rem: remaining(r, clock, now) }));
  const nothingRunning = !builtinRunning.length && !customRunning.length;

  const allHotkeys = [
    ...Object.values(s.hotkeys),
    ...s.customTimers.filter((d) => d.id !== draft.id).map((d) => d.hotkey),
  ];

  async function saveDraft() {
    const duration = parseDuration(draft.duration);
    const lead = Number(draft.lead || 0);
    const def: CustomTimerDef = {
      id: draft.id ?? newId(),
      name: draft.name.trim(),
      duration: duration ?? 0,
      hotkey: draft.hotkey,
      voice: draft.voice,
      lead: Number.isFinite(lead) ? lead : 0,
    };
    const err =
      duration === null
        ? "Длительность в формате мм:сс, например 7:00"
        : validateDef(def) ??
          (draft.hotkey && duplicateHotkeys([...allHotkeys, draft.hotkey]).has(draft.hotkey.toLowerCase())
            ? `Хоткей ${prettyHotkey(draft.hotkey)} уже занят`
            : null);
    if (err) {
      setError(err);
      return;
    }
    const list = draft.id
      ? s.customTimers.map((d) => (d.id === draft.id ? def : d))
      : [...s.customTimers, def];
    await update({ customTimers: list });
    setDraft(EMPTY);
    setError(null);
  }

  function edit(d: CustomTimerDef) {
    setDraft({
      id: d.id,
      name: d.name,
      duration: formatClock(d.duration),
      hotkey: d.hotkey,
      voice: d.voice,
      lead: String(d.lead),
    });
    setError(null);
  }

  return (
    <div className="space-y-4">
      <Card title="Запущенные таймеры">
        {nothingRunning ? (
          <p className="text-sm text-zinc-400">
            Сейчас ничего не запущено. Нажмите хоткей или кнопку ниже — таймер появится здесь и в оверлее.
          </p>
        ) : (
          <ul className="space-y-1">
            {builtinRunning.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded bg-zinc-800/70 px-3 py-2 text-sm">
                <span>{v.label}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular font-semibold">{formatClock(v.remaining)}</span>
                  <button
                    className="text-xs text-zinc-400 hover:text-red-300"
                    onClick={() => send({ type: "clear", key: BUILTIN_OF[v.id]! })}
                  >
                    Остановить
                  </button>
                </span>
              </li>
            ))}
            {customRunning.map(({ run, rem }) => (
              <li key={run.runId} className="flex items-center justify-between rounded bg-zinc-800/70 px-3 py-2 text-sm">
                <span>
                  <span className="mr-1 text-sky-300">◆</span>
                  {run.name}
                </span>
                <span className="flex items-center gap-3">
                  <span className={`tabular font-semibold ${rem <= 0 ? "text-radiant" : ""}`}>
                    {rem <= 0 ? "готово" : formatClock(rem)}
                  </span>
                  <button
                    className="text-xs text-zinc-400 hover:text-red-300"
                    onClick={() => send({ type: "stop", runId: run.runId })}
                  >
                    Остановить
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Запуск">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BUILTIN) as BuiltinKey[]).map((k) => (
            <Button key={k} variant="ghost" onClick={() => send({ type: "mark", key: k })}>
              {BUILTIN[k].button}
              <span className="ml-2 text-xs text-zinc-500">{prettyHotkey(s.hotkeys[BUILTIN_HOTKEY[k]])}</span>
            </Button>
          ))}
          {s.customTimers.map((d) => (
            <Button key={d.id} variant="ghost" onClick={() => send({ type: "start", defId: d.id })}>
              <span className="mr-1 text-sky-300">◆</span>
              {d.name}
              {d.hotkey && <span className="ml-2 text-xs text-zinc-500">{prettyHotkey(d.hotkey)}</span>}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-zinc-300">Зарядов глифа у противника:</span>
          {[1, 2].map((n) => (
            <button
              key={n}
              className={`rounded-md px-3 py-1 ${
                s.enemyGlyphCharges === n ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
              onClick={() => update({ enemyGlyphCharges: n })}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-zinc-500">
            Каждое нажатие тратит заряд, заряды возвращаются по одному раз в 5:00.
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Рошан, глиф и тормент считаются по игровым часам, поэтому работают только во время матча. Свои таймеры
          работают и вне игры.
        </p>
      </Card>

      <Card title="Мои таймеры">
        {s.customTimers.length > 0 && (
          <ul className="mb-4 divide-y divide-zinc-800">
            {s.customTimers.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1">
                  <span className="mr-1 text-sky-300">◆</span>
                  {d.name}
                </span>
                <span className="tabular text-zinc-400">{formatClock(d.duration)}</span>
                <span className="w-28 text-xs text-zinc-500">{prettyHotkey(d.hotkey)}</span>
                <span className="w-16 text-xs text-zinc-500">{d.voice ? "голос" : "без голоса"}</span>
                <Button variant="ghost" onClick={() => edit(d)}>
                  Изменить
                </Button>
                <Button
                  variant="danger"
                  onClick={() => update({ customTimers: s.customTimers.filter((x) => x.id !== d.id) })}
                >
                  Удалить
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1.4fr]">
          <Field label="Название">
            <input
              className={inputClass}
              placeholder="Например: Смок"
              maxLength={40}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Длительность" hint="мм:сс">
            <input
              className={inputClass}
              placeholder="7:00"
              value={draft.duration}
              onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
            />
          </Field>
          <Field label="Предупредить за, с">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={draft.lead}
              onChange={(e) => setDraft({ ...draft, lead: e.target.value })}
            />
          </Field>
          <Field label="Хоткей" hint="Кликните и нажмите сочетание">
            <HotkeyInput value={draft.hotkey} onChange={(hotkey) => setDraft({ ...draft, hotkey })} />
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Toggle checked={draft.voice} onChange={(voice) => setDraft({ ...draft, voice })} label="Озвучивать" />
          <Button onClick={saveDraft}>{draft.id ? "Сохранить" : "Добавить таймер"}</Button>
          {draft.id && (
            <Button variant="ghost" onClick={() => setDraft(EMPTY)}>
              Отмена
            </Button>
          )}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </Card>
    </div>
  );
}
