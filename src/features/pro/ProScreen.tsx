import { Button, Card, Field, inputClass } from "../../shared/ui";
import { useSettings } from "../settings/store";
import { isPro } from "./flags";
import { PLANS, formatPrice, yearlySavingPercent } from "./plans";

const FEATURES = [
  "ИИ-разбор каждого матча: ошибки, сильные стороны, фокус на следующую игру",
  "История прогресса LH@10, GPM и таймингов по героям",
  "Расширенные пресеты таймеров и голосовых пакетов",
];

export function ProScreen() {
  const { settings, update } = useSettings();
  const s = settings!;
  return (
    <div className="space-y-4">
      <Card title={isPro(s) ? "DotaPilot Pro активен" : "DotaPilot Pro"}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
          {FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {PLANS.map((p) => (
            <div key={p.id} className="rounded-lg border border-zinc-700 p-4">
              <div className="flex items-center justify-between font-semibold">
                {p.name}
                {p.id === "year" && (
                  <span className="rounded bg-radiant/20 px-1.5 py-0.5 text-xs text-radiant">
                    −{yearlySavingPercent()}%
                  </span>
                )}
              </div>
              <div className="text-xl text-gold">
                {formatPrice(p.price)}
                <span className="text-sm text-zinc-400"> / {p.period}</span>
              </div>
              <div className="text-xs text-zinc-500">{p.note}</div>
              <Button className="mt-3" disabled title="Оплата появится в следующей версии">
                Оформить
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Оплата появится в следующей версии.</p>
      </Card>

      <Card title="Для разработки">
        <div className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.isPro} onChange={(e) => update({ isPro: e.target.checked })} />
            Feature-flag <code>isPro</code>
          </label>
          <Field label="URL прокси ИИ-разбора" hint="Ключ Anthropic хранится только на прокси (proxy/.env), не в клиенте.">
            <input
              className={inputClass}
              defaultValue={s.aiProxyUrl}
              onBlur={(e) => update({ aiProxyUrl: e.target.value.trim() })}
            />
          </Field>
        </div>
      </Card>
    </div>
  );
}
