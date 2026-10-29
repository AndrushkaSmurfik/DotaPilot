import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { Button, Card, Field, Toggle, inputClass } from "../../shared/ui";
import { speak } from "../../shared/speech";
import { OVERLAY_SETUP_EVENT } from "../../overlay/events";
import { TIMER_IDS, TIMER_LABELS } from "../timers/config";
import { HotkeyInput } from "../custom/HotkeyInput";
import { generateToken, isValidPort, type AppSettings, type Hotkeys } from "./model";
import { installGsiConfig, useSettings } from "./store";

const HOTKEY_LABELS: Record<keyof Hotkeys, string> = {
  roshan: "Рошан убит (старт Рошан + аегис)",
  glyph: "Враг нажал глиф",
  tormentor: "Тормент убит (респавн 10 мин)",
  toxic: "Отметить токсика (напомню о репорте)",
  setupMode: "Режим настройки оверлея",
  resetManual: "Сбросить ручные таймеры",
};

export function SettingsScreen() {
  const { settings, update, startServer, serverError } = useSettings();
  const [port, setPort] = useState(String(settings!.gsiPort));
  const [msg, setMsg] = useState<string | null>(null);
  const [autostart, setAutostart] = useState(false);
  const s = settings!;

  useEffect(() => {
    isAutostartEnabled().then(setAutostart).catch(() => setAutostart(false));
  }, []);

  async function toggleAutostart(on: boolean) {
    try {
      if (on) await enableAutostart();
      else await disableAutostart();
      setAutostart(await isAutostartEnabled());
    } catch (e) {
      setMsg(`Автозапуск: ${String(e)}`);
    }
  }

  async function applyServer(next: AppSettings) {
    await startServer();
    if (next.dotaPath) {
      try {
        await installGsiConfig(next);
        setMsg("Сервер перезапущен, конфиг GSI обновлён. Перезапустите Dota 2.");
      } catch (e) {
        setMsg(String(e));
      }
    } else setMsg("Сервер перезапущен.");
  }

  return (
    <div className="space-y-4">
      <Card title="GSI-сервер">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Порт" hint="127.0.0.1, по умолчанию 3000">
            <input className={inputClass} value={port} onChange={(e) => setPort(e.target.value)} />
          </Field>
          <Field label="Папка Dota 2">
            <div className="truncate rounded bg-zinc-950 px-2 py-1.5 font-mono text-xs">{s.dotaPath ?? "не выбрана"}</div>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={!isValidPort(Number(port))}
            onClick={async () => applyServer(await update({ gsiPort: Number(port) }))}
          >
            Применить порт
          </Button>
          <Button variant="ghost" onClick={async () => applyServer(await update({ gsiToken: generateToken() }))}>
            Сменить токен
          </Button>
          <Button variant="ghost" onClick={() => update({ onboarded: false })}>
            Повторить онбординг
          </Button>
        </div>
        {msg && <p className="mt-2 text-sm text-zinc-300">{msg}</p>}
        {serverError && <p className="mt-2 text-sm text-red-400">{serverError}</p>}
      </Card>

      <Card title="Таймеры и оповещения">
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <Toggle checked={s.voice} onChange={(voice) => update({ voice })} label="Голосовые оповещения" />
          <label className="flex items-center gap-2 text-sm">
            Громкость
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.voiceVolume}
              onChange={(e) => update({ voiceVolume: Number(e.target.value) })}
            />
          </label>
          <Button variant="ghost" onClick={() => speak("Руна силы через 15 секунд", s.voiceVolume)}>
            Проверить голос
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-400">
            <tr>
              <th className="py-1">Таймер</th>
              <th>Показ</th>
              <th>Голос</th>
              <th>За сколько сек.</th>
            </tr>
          </thead>
          <tbody>
            {TIMER_IDS.map((id) => {
              const t = s.timers[id];
              const set = (patch: Partial<typeof t>) =>
                update({ timers: { ...s.timers, [id]: { ...t, ...patch } } });
              return (
                <tr key={id} className="border-t border-zinc-800">
                  <td className="py-1.5">{TIMER_LABELS[id]}</td>
                  <td>
                    <Toggle checked={t.enabled} onChange={(enabled) => set({ enabled })} />
                  </td>
                  <td>
                    <Toggle checked={t.voice} onChange={(voice) => set({ voice })} />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      className={`${inputClass} w-20`}
                      value={t.lead}
                      onChange={(e) => set({ lead: Math.max(0, Number(e.target.value)) })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Оверлей и хоткеи">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <Toggle
            checked={s.overlay.visible}
            onChange={(visible) => update({ overlay: { ...s.overlay, visible } })}
            label="Показывать оверлей"
          />
          <label className="flex items-center gap-2 text-sm">
            Прозрачность
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={s.overlay.opacity}
              onChange={(e) => update({ overlay: { ...s.overlay, opacity: Number(e.target.value) } })}
            />
          </label>
          <Toggle
            checked={s.overlay.showBuyback}
            onChange={(showBuyback) => update({ overlay: { ...s.overlay, showBuyback } })}
            label="Показывать байбек"
          />
          <Button variant="ghost" onClick={() => emit(OVERLAY_SETUP_EVENT)}>
            Режим перетаскивания
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(HOTKEY_LABELS) as (keyof Hotkeys)[]).map((k) => (
            <Field key={k} label={HOTKEY_LABELS[k]}>
              <HotkeyInput value={s.hotkeys[k]} onChange={(v) => update({ hotkeys: { ...s.hotkeys, [k]: v } })} />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Кликните по полю и нажмите сочетание. Хоткеи только запускают таймеры DotaPilot и ничего не отправляют в
          игру. Учтите: назначенное сочетание перехватывается целиком и до Dota не доходит. Например, Alt+R
          отключит в игре alt-каст ультимейта. В этом случае выберите другое сочетание, скажем Alt+F1.
        </p>
      </Card>

      <Card title="Система">
        <div className="flex flex-wrap gap-6">
          <Toggle checked={autostart} onChange={toggleAutostart} label="Запускать вместе с Windows (свёрнуто в трей)" />
          <Toggle
            checked={s.systemNotifications}
            onChange={(systemNotifications) => update({ systemNotifications })}
            label="Уведомления Windows после матча"
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Крестик главного окна сворачивает DotaPilot в трей — оверлей продолжает работать. Выход — через меню значка в трее.
        </p>
      </Card>

      <Card title="Анти-тильт">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Предупреждать после N поражений подряд">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={s.tilt.lossStreakWarn}
              onChange={(e) => update({ tilt: { ...s.tilt, lossStreakWarn: Math.max(1, Number(e.target.value)) } })}
            />
          </Field>
          <Field label="Напоминать о перерыве после, мин">
            <input
              type="number"
              min={30}
              className={inputClass}
              value={s.tilt.sessionWarnMinutes}
              onChange={(e) => update({ tilt: { ...s.tilt, sessionWarnMinutes: Math.max(30, Number(e.target.value)) } })}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Toggle
            checked={s.tilt.praiseReminder}
            onChange={(praiseReminder) => update({ tilt: { ...s.tilt, praiseReminder } })}
            label="Напоминать похвалить тиммейтов после матча"
          />
        </div>
      </Card>
    </div>
  );
}
