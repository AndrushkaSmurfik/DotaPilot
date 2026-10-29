import { useEffect, useState } from "react";
import { setMarksReported, toxicMarks } from "../../shared/db";
import { Card, Toggle } from "../../shared/ui";
import { REPORT_STEPS, formatMarkTimes, type ToxicMark } from "./logic";

/** Shown on the post-match screen when the player marked toxic moments during the game. */
export function ReportCard({ matchId }: { matchId: string }) {
  const [marks, setMarks] = useState<ToxicMark[]>([]);

  useEffect(() => {
    toxicMarks(matchId).then(setMarks);
  }, [matchId]);

  if (!marks.length) return null;
  const reported = marks.every((m) => m.reported);

  return (
    <Card title={`Репорт · отмечено ${marks.length}`} className={reported ? "opacity-70" : "border-red-900"}>
      <p className="mb-2 text-sm text-zinc-300">Моменты: {formatMarkTimes(marks)}</p>
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-zinc-400">
        {REPORT_STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Toggle
        checked={reported}
        label="Репорт отправлен"
        onChange={async (v) => {
          await setMarksReported(matchId, v);
          setMarks((ms) => ms.map((m) => ({ ...m, reported: v ? 1 : 0 })));
        }}
      />
    </Card>
  );
}
