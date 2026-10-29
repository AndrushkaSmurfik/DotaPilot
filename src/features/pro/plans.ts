// Subscription plans shown on the Pro screen. Prices in rubles; billing is not wired yet.

export interface Plan {
  id: "month" | "year";
  name: string;
  price: number;
  period: string;
  note: string;
}

export const PLANS: Plan[] = [
  { id: "month", name: "Месяц", price: 299, period: "мес", note: "Отмена в любой момент" },
  { id: "year", name: "Год", price: 2390, period: "год", note: "≈ 199 ₽/мес" },
];

export function formatPrice(rub: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(rub)} ₽`;
}

/** Savings of the yearly plan vs paying monthly, in whole percent. */
export function yearlySavingPercent(plans: Plan[] = PLANS): number {
  const month = plans.find((p) => p.id === "month")!.price;
  const year = plans.find((p) => p.id === "year")!.price;
  return Math.round((1 - year / (month * 12)) * 100);
}
