import { describe, expect, it } from "vitest";
import { buybackStatus } from "./buyback";

describe("buybackStatus", () => {
  it("reports ready, missing gold and cooldown", () => {
    expect(buybackStatus(3000, 1800, 0)).toEqual({ state: "ready", text: "Байбек готов (1800 з.)" });
    expect(buybackStatus(1500, 1800, 0)).toEqual({ state: "no-gold", text: "Байбек: не хватает 300 з." });
    expect(buybackStatus(5000, 1800, 125)).toEqual({ state: "cooldown", text: "Байбек: откат 2:05" });
  });

  it("is hidden without GSI data", () => {
    expect(buybackStatus(undefined, 1800, 0)).toBeNull();
    expect(buybackStatus(1000, undefined, 0)).toBeNull();
    expect(buybackStatus(1000, 0, 0)).toBeNull();
  });
});
