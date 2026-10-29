import { useState } from "react";
import { Button, Card } from "../../shared/ui";
import type { PostMatchSummary } from "../postmatch/analysis";
import { useSettings } from "../settings/store";
import { requestAiReview, type AiReview } from "./aiReview";
import { isPro } from "./flags";

export function AiReviewPanel({ summary, onOpenPro }: { summary: PostMatchSummary; onOpenPro: () => void }) {
  const settings = useSettings((s) => s.settings)!;
  const [review, setReview] = useState<AiReview | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isPro(settings)) {
    return (
      <Card title="ИИ-разбор матча · Pro">
        <p className="text-sm text-zinc-400">Персональный разбор ошибок и фокус на следующую игру.</p>
        <Button className="mt-3" onClick={onOpenPro}>
          Узнать о Pro
        </Button>
      </Card>
    );
  }

  return (
    <Card title="ИИ-разбор матча">
      {!review && (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setReview(await requestAiReview(summary, settings.aiProxyUrl));
            setBusy(false);
          }}
        >
          {busy ? "Анализируем…" : "Разобрать матч"}
        </Button>
      )}
      {review && (
        <div className="space-y-3 text-sm">
          <p className="font-semibold">{review.headline}</p>
          {review.strengths.length > 0 && (
            <div>
              <div className="text-xs uppercase text-radiant">Сильные стороны</div>
              <ul className="list-disc pl-5">{review.strengths.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          {review.mistakes.length > 0 && (
            <div>
              <div className="text-xs uppercase text-dire">Что улучшить</div>
              <ul className="list-disc pl-5">{review.mistakes.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          <p>
            <span className="text-gold">Фокус на следующую игру:</span> {review.focus}
          </p>
          {review.mock && <p className="text-xs text-zinc-500">Демо-ответ (ИИ пока не подключён).</p>}
        </div>
      )}
    </Card>
  );
}
