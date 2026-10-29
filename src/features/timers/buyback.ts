import { formatClock } from "./logic";

export type BuybackState = "ready" | "cooldown" | "no-gold";

export interface BuybackStatus {
  state: BuybackState;
  text: string;
}

/** Buyback availability from GSI hero.buyback_cost / buyback_cooldown and player.gold. */
export function buybackStatus(
  gold: number | undefined,
  cost: number | undefined,
  cooldown: number | undefined,
): BuybackStatus | null {
  if (gold === undefined || cost === undefined || cost <= 0) return null;
  if (cooldown !== undefined && cooldown > 0) {
    return { state: "cooldown", text: `Байбек: откат ${formatClock(cooldown)}` };
  }
  if (gold < cost) {
    return { state: "no-gold", text: `Байбек: не хватает ${cost - gold} з.` };
  }
  return { state: "ready", text: `Байбек готов (${cost} з.)` };
}
