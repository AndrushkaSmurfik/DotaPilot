import { useState } from "react";
import { inputClass } from "../../shared/ui";
import { comboFromEvent, prettyHotkey } from "./hotkey";

/** Click, press a combination — it's captured. Backspace/Delete clears, Esc cancels. */
export function HotkeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [capturing, setCapturing] = useState(false);
  return (
    <div className="flex gap-1">
      <input
        readOnly
        className={`${inputClass} cursor-pointer ${capturing ? "border-gold text-gold" : ""}`}
        value={capturing ? "Нажмите сочетание…" : prettyHotkey(value)}
        onFocus={() => setCapturing(true)}
        onBlur={() => setCapturing(false)}
        onKeyDown={(e) => {
          e.preventDefault();
          if (e.code === "Escape") {
            e.currentTarget.blur();
            return;
          }
          if ((e.code === "Backspace" || e.code === "Delete") && !e.altKey && !e.ctrlKey && !e.shiftKey) {
            onChange("");
            e.currentTarget.blur();
            return;
          }
          const combo = comboFromEvent(e);
          if (combo) {
            onChange(combo);
            e.currentTarget.blur();
          }
        }}
      />
      {value && (
        <button
          type="button"
          className="rounded px-2 text-zinc-500 hover:text-zinc-200"
          title="Убрать хоткей"
          onClick={() => onChange("")}
        >
          ×
        </button>
      )}
    </div>
  );
}
