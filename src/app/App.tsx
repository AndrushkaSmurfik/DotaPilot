import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { connectGsi } from "../shared/gsi/store";
import { TRAY_TOGGLE_OVERLAY_EVENT } from "../overlay/events";
import { HistoryScreen } from "../features/history/HistoryScreen";
import { ConfigsScreen } from "../features/configs/ConfigsScreen";
import { TimersScreen } from "../features/custom/TimersScreen";
import { useSettings } from "../features/settings/store";
import { Onboarding } from "../features/settings/Onboarding";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { PostMatchScreen } from "../features/postmatch/PostMatchScreen";
import type { PostMatchTarget } from "../features/postmatch/usePostMatch";
import { ProScreen } from "../features/pro/ProScreen";
import { useMatchWatcher } from "../features/tilt/useMatchWatcher";
import type { TiltMessage } from "../features/tilt/logic";
import { Dashboard } from "./Dashboard";

const TABS = [
  ["dashboard", "Главная"],
  ["timers", "Таймеры"],
  ["postmatch", "Пост-матч"],
  ["history", "История"],
  ["configs", "Конфиги"],
  ["settings", "Настройки"],
  ["pro", "Pro"],
] as const;

type Tab = (typeof TABS)[number][0];

export function App() {
  const { settings, init } = useSettings();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [target, setTarget] = useState<PostMatchTarget | null>(null);
  const [tiltMessages, setTiltMessages] = useState<TiltMessage[]>([]);

  useEffect(() => {
    init();
    const unlisteners = [
      connectGsi(),
      listen(TRAY_TOGGLE_OVERLAY_EVENT, () => {
        const { settings: s, update } = useSettings.getState();
        if (s) update({ overlay: { ...s.overlay, visible: !s.overlay.visible } });
      }),
    ];
    return () => {
      unlisteners.forEach((p) => p.then((f) => f()));
    };
  }, [init]);

  useMatchWatcher((t, messages) => {
    setTarget(t);
    setTiltMessages(messages);
    setTab("postmatch");
  });

  if (!settings) return <div className="p-8 text-sm text-zinc-400">Загрузка…</div>;
  if (!settings.onboarded) return <Onboarding />;

  return (
    <div className="flex h-screen">
      <nav className="w-48 shrink-0 border-r border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-6 text-lg font-bold">
          Dota<span className="text-dire">Pilot</span>
        </div>
        <ul className="space-y-1">
          {TABS.map(([id, label]) => (
            <li key={id}>
              <button
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  tab === id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
                {id === "pro" && settings.isPro && <span className="ml-1 text-xs text-gold">●</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 overflow-y-auto p-6">
        {tab === "dashboard" && <Dashboard tiltMessages={tiltMessages} refreshKey={target} />}
        {tab === "postmatch" && (
          <PostMatchScreen
            key={target?.matchId}
            target={target}
            onTarget={setTarget}
            onOpenPro={() => setTab("pro")}
          />
        )}
        {tab === "history" && (
          <HistoryScreen
            onOpen={(t) => {
              setTarget(t);
              setTab("postmatch");
            }}
          />
        )}
        {tab === "timers" && <TimersScreen />}
        {tab === "configs" && <ConfigsScreen />}
        {tab === "settings" && <SettingsScreen />}
        {tab === "pro" && <ProScreen />}
      </main>
    </div>
  );
}
