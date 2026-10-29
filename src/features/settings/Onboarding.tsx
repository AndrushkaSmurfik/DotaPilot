import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, Card } from "../../shared/ui";
import { installGsiConfig, useSettings } from "./store";

type Status =
  | { kind: "detecting" }
  | { kind: "found"; path: string }
  | { kind: "not-found" }
  | { kind: "installed"; cfg: string }
  | { kind: "error"; message: string };

export function Onboarding() {
  const { settings, update } = useSettings();
  const [status, setStatus] = useState<Status>({ kind: "detecting" });
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>("detect_dota_path").then((p) => {
      if (p) {
        setPath(p);
        setStatus({ kind: "found", path: p });
      } else setStatus({ kind: "not-found" });
    });
  }, []);

  async function pickManually() {
    const dir = await open({ directory: true, title: "Папка Dota 2 (…/steamapps/common/dota 2 beta)" });
    if (typeof dir !== "string") return;
    if (await invoke<boolean>("validate_dota_path", { path: dir })) {
      setPath(dir);
      setStatus({ kind: "found", path: dir });
    } else {
      setStatus({ kind: "error", message: `В «${dir}» нет папки game/dota. Выберите «dota 2 beta».` });
    }
  }

  async function install() {
    if (!settings || !path) return;
    try {
      const cfg = await installGsiConfig(settings, path);
      await update({ dotaPath: path });
      setStatus({ kind: "installed", cfg });
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Добро пожаловать в DotaPilot</h1>
      <p className="text-sm text-zinc-400">
        DotaPilot получает данные только через официальный Game State Integration от Valve: игра сама
        отправляет состояние матча на локальный адрес 127.0.0.1. Никакого чтения памяти и автоматизации.
      </p>

      <Card title="1. Папка Dota 2">
        {status.kind === "detecting" && <p className="text-sm">Ищем Dota 2 через Steam…</p>}
        {status.kind === "not-found" && (
          <p className="text-sm text-zinc-300">Не удалось найти автоматически — выберите папку вручную.</p>
        )}
        {path && status.kind !== "detecting" && (
          <p className="break-all rounded bg-zinc-950 px-2 py-1 font-mono text-xs">{path}</p>
        )}
        {status.kind === "error" && <p className="mt-2 text-sm text-red-400">{status.message}</p>}
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" onClick={pickManually}>
            Выбрать вручную
          </Button>
          <Button disabled={!path || status.kind === "installed"} onClick={install}>
            Установить конфиг GSI
          </Button>
        </div>
      </Card>

      {status.kind === "installed" && (
        <Card title="2. Запуск Dota 2">
          <p className="text-sm">Конфиг создан:</p>
          <p className="mb-3 break-all font-mono text-xs text-zinc-400">{status.cfg}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-300">
            <li>
              Steam → Dota 2 → Свойства → Параметры запуска: добавьте <code className="text-gold">-gamestateintegration</code>
            </li>
            <li>Перезапустите Dota 2, если она открыта.</li>
            <li>
              Для оверлея поставьте в игре режим экрана <b>«Окно без рамки»</b> — поверх эксклюзивного
              полноэкранного режима окна не отображаются.
            </li>
          </ol>
          <Button className="mt-4" onClick={() => update({ onboarded: true })}>
            Готово
          </Button>
        </Card>
      )}

      <button className="text-xs text-zinc-500 underline" onClick={() => update({ onboarded: true })}>
        Пропустить (только мок-режим)
      </button>
    </div>
  );
}
