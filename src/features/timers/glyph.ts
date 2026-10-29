// Enemy glyph as a charge counter (Dota's usual charge rules): one charge
// restores per cooldown, the restore clock runs only while below max, and
// charges come back one at a time.

export interface GlyphState {
  charges: number;
  max: number;
  /** clock_time when the next charge returns, null when full. */
  nextAt: number | null;
}

/**
 * State at `clock` given the clock times the user marked glyph usage.
 * A press with no charge left is trusted (the enemy did use it) and restarts the restore.
 */
export function glyphState(uses: number[], clock: number, max: number, cooldown: number): GlyphState {
  let charges = max;
  let nextAt: number | null = null;

  const advance = (t: number) => {
    while (nextAt !== null && nextAt <= t) {
      charges++;
      nextAt = charges < max ? nextAt + cooldown : null;
    }
  };

  for (const t of [...uses].sort((a, b) => a - b)) {
    if (t > clock) break;
    advance(t);
    if (charges > 0) {
      charges--;
      if (nextAt === null) nextAt = t + cooldown;
    } else {
      nextAt = t + cooldown;
    }
  }
  advance(clock);
  return { charges, max, nextAt };
}

/** Every future clock time a charge comes back (for the timer schedule and alerts). */
export function glyphRestoreTimes(uses: number[], max: number, cooldown: number): number[] {
  if (!uses.length) return [];
  const last = Math.max(...uses);
  const out: number[] = [];
  // Before the last press the history can still change; schedule from the last press on.
  let s = glyphState(uses, last, max, cooldown);
  while (s.nextAt !== null) {
    out.push(s.nextAt);
    s = glyphState(uses, s.nextAt, max, cooldown);
  }
  // Restores between earlier presses also matter while they are in the future.
  const earlier: number[] = [];
  for (const t of [...uses].sort((a, b) => a - b)) {
    const st = glyphState(uses, t, max, cooldown);
    if (st.nextAt !== null && st.nextAt < last) earlier.push(st.nextAt);
  }
  return [...new Set([...earlier, ...out])].sort((a, b) => a - b);
}
