import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, Card } from "../../shared/ui";
import { useSettings } from "../settings/store";
import { BACKUP_NAME, configsApi, formatSize, importMany, type ConfigEntry } from "./api";

type Notice = { kind: "ok" | "error"; text: string } | null;

export function ConfigsScreen() {
  const dotaPath = useSettings((s) => s.settings?.dotaPath ?? null);
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setConfigs(await configsApi.list());
    setActive(dotaPath ? await configsApi.active(dotaPath) : null);
  }, [dotaPath]);

  useEffect(() => {
    refresh().catch((e) => setNotice({ kind: "error", text: String(e) }));
  }, [refresh]);

  async function onImport() {
    const picked = await open({
      multiple: true,
      title: "Выберите конфиги Dota 2",
      filters: [{ name: "Конфиг Dota 2", extensions: ["cfg"] }],
    });
    const paths = picked === null ? [] : Array.isArray(picked) ? picked : [picked];
    if (!paths.length) return;
    const { imported, errors } = await importMany(paths);
    await refresh();
    setNotice(
      errors.length
        ? { kind: "error", text: `Загружено ${imported.length}. Ошибки: ${errors.join("; ")}` }
        : { kind: "ok", text: `Загружено конфигов: ${imported.length}` },
    );
  }

  async function onApply(name: string) {
    if (!dotaPath) return;
    setBusy(true);
    try {
      const r = await configsApi.apply(name, dotaPath);
      await refresh();
      setNotice({
        kind: "ok",
        text:
          `«${name}» записан в autoexec.cfg. Сработает при следующем запуске Dota ` +
          `(или введите в консоли игры: exec autoexec).` +
          (r.backup_created ? ` Ваш прежний autoexec сохранён как «${BACKUP_NAME}».` : ""),
      });
    } catch (e) {
      setNotice({ kind: "error", text: String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(name: string) {
    await configsApi.remove(name);
    if (preview?.name === name) setPreview(null);
    await refresh();
  }

  async function onPreview(name: string) {
    setPreview(preview?.name === name ? null : { name, text: await configsApi.read(name) });
  }

  return (
    <div className="space-y-4">
      <Card title="Конфиги Dota 2 (autoexec.cfg)">
        <p className="text-sm text-zinc-400">
          Загрузите несколько конфигов и переключайтесь между ними в один клик: выбранный записывается в{" "}
          <code className="text-zinc-300">game/dota/cfg/autoexec.cfg</code> вместо старого. Ваш исходный autoexec
          сохраняется резервной копией перед первой заменой.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={onImport}>Загрузить конфиги…</Button>
          {!dotaPath && <span className="text-sm text-amber-300">Папка Dota не выбрана — пройдите онбординг в настройках.</span>}
        </div>
        {notice && (
          <p className={`mt-3 text-sm ${notice.kind === "ok" ? "text-radiant" : "text-red-400"}`}>{notice.text}</p>
        )}
      </Card>

      <Card title={`Библиотека · ${configs.length}`}>
        {configs.length === 0 ? (
          <p className="text-sm text-zinc-400">Пока пусто.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {configs.map((c) => {
              const isActive = c.name === active;
              return (
                <li key={c.name} className="py-2">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? "bg-radiant" : "bg-zinc-700"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        {c.name}
                        {isActive && <span className="ml-2 text-xs text-radiant">активен</span>}
                      </div>
                      <div className="text-xs text-zinc-500">{formatSize(c.size)}</div>
                    </div>
                    <Button variant="ghost" onClick={() => onPreview(c.name)}>
                      {preview?.name === c.name ? "Скрыть" : "Просмотр"}
                    </Button>
                    <Button disabled={!dotaPath || isActive || busy} onClick={() => onApply(c.name)}>
                      {isActive ? "Выбран" : "Выбрать"}
                    </Button>
                    <Button variant="danger" onClick={() => onDelete(c.name)}>
                      Удалить
                    </Button>
                  </div>
                  {preview?.name === c.name && (
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300">
                      {preview.text || "(пустой файл)"}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          «Удалить» убирает конфиг только из библиотеки DotaPilot — файл в папке Dota не трогается.
        </p>
      </Card>
    </div>
  );
}
