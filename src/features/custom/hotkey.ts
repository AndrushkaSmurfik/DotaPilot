// Turns a keydown into a Tauri global-shortcut string ("Alt+R", "CommandOrControl+Shift+F1").

export interface KeyLike {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (/^Numpad\d$/.test(code)) return `Num${code.slice(6)}`;
  const named: Record<string, string> = {
    Backspace: "Backspace",
    Delete: "Delete",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Space: "Space",
    Minus: "Minus",
    Equal: "Equal",
    BracketLeft: "BracketLeft",
    BracketRight: "BracketRight",
    Semicolon: "Semicolon",
    Quote: "Quote",
    Comma: "Comma",
    Period: "Period",
    Slash: "Slash",
    Backslash: "Backslash",
    Backquote: "Backquote",
  };
  return named[code] ?? null;
}

/**
 * null while only modifiers are held or for unsupported keys. A letter/digit
 * needs a modifier so a plain "R" never gets stolen from the game.
 */
export function comboFromEvent(e: KeyLike): string | null {
  const key = keyFromCode(e.code);
  if (!key) return null;
  const mods = [
    e.ctrlKey || e.metaKey ? "CommandOrControl" : null,
    e.altKey ? "Alt" : null,
    e.shiftKey ? "Shift" : null,
  ].filter(Boolean);
  const isFKey = /^F\d+$/.test(key);
  if (!mods.length && !isFKey) return null;
  return [...mods, key].join("+");
}

/** "CommandOrControl+Alt+R" → "Ctrl+Alt+R" for display. */
export function prettyHotkey(combo: string): string {
  return combo ? combo.replace("CommandOrControl", "Ctrl") : "—";
}

/** Hotkeys bound to more than one action (case-insensitive). */
export function duplicateHotkeys(combos: string[]): Set<string> {
  const seen = new Map<string, number>();
  for (const c of combos.filter(Boolean)) {
    const k = c.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}
