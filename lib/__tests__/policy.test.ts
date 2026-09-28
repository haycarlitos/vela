import { describe, it, expect } from "vitest";
import { decide, spendingPolicies, usdToBaseUnits, type Portfolio } from "../policy";
import { TOKENS } from "../config";

const portfolio: Portfolio = {
  USDC: { balance: 40, usd: 40 },
  ETH: { balance: 0.01, usd: 30 },
  STRK: { balance: 100, usd: 12 },
  vesuUsd: 20,
};

const balanced = { strategy: "balanced" as const, maxTradeUsd: 5 };

describe("decide", () => {
  it("holds on anything that is not a valid decision", () => {
    expect(decide({ raw: "buy ETH" }, portfolio, balanced)).toMatchObject({ kind: "hold" });
    expect(decide({ action: "bridge", reason: "x" }, portfolio, balanced)).toMatchObject({ kind: "hold" });
    expect(decide(null, portfolio, balanced)).toMatchObject({ kind: "hold" });
  });

  it("passes the model's reason through on a hold", () => {
    expect(decide({ action: "hold", reason: "RSI neutral" }, portfolio, balanced)).toEqual({
      kind: "hold",
      reason: "RSI neutral",
    });
  });

  it("caps a swap at the user's max trade, whatever the model asked", () => {
    const action = decide(
      { action: "swap", from: "usdc", to: "eth", amount: 500, reason: "dip" },
      portfolio,
      balanced
    );
    expect(action).toEqual({ kind: "swap", from: "USDC", to: "ETH", amountUsd: 5, reason: "dip" });
  });

  it("keeps the x402 reserve in USDC", () => {
    const low = { ...portfolio, USDC: { balance: 3, usd: 3 } };
    expect(decide({ action: "swap", from: "USDC", to: "ETH", amount: 5, reason: "x" }, low, balanced)).toMatchObject({
      kind: "swap",
      amountUsd: 2,
    });
    const reserveOnly = { ...portfolio, USDC: { balance: 1.2, usd: 1.2 } };
    expect(
      decide({ action: "swap", from: "USDC", to: "ETH", amount: 5, reason: "x" }, reserveOnly, balanced)
    ).toMatchObject({ kind: "hold" });
  });

  it("never swaps more than the wallet holds of the source token", () => {
    expect(
      decide({ action: "swap", from: "STRK", to: "USDC", amount: 5, reason: "x" }, { ...portfolio, STRK: { balance: 10, usd: 1.23 } }, balanced)
    ).toMatchObject({ kind: "swap", amountUsd: 1.23 });
  });

  it.each([
    ["an unknown token", { from: "USDC", to: "DOGE" }],
    ["the same token on both sides", { from: "ETH", to: "eth" }],
    ["a missing side", { from: "USDC" }],
  ])("holds on a swap with %s", (_label, sides) => {
    expect(decide({ action: "swap", amount: 5, reason: "x", ...sides }, portfolio, balanced)).toMatchObject({
      kind: "hold",
    });
  });

  it("holds when the amount is missing, zero or below the minimum", () => {
    expect(decide({ action: "swap", from: "USDC", to: "ETH", reason: "x" }, portfolio, balanced)).toMatchObject({ kind: "hold" });
    expect(decide({ action: "swap", from: "USDC", to: "ETH", amount: 0, reason: "x" }, portfolio, balanced)).toMatchObject({ kind: "hold" });
    expect(decide({ action: "swap", from: "USDC", to: "ETH", amount: 0.2, reason: "x" }, portfolio, balanced)).toMatchObject({ kind: "hold" });
  });

  it("the conservative strategy never swaps", () => {
    expect(
      decide({ action: "swap", from: "USDC", to: "ETH", amount: 5, reason: "x" }, portfolio, { strategy: "conservative", maxTradeUsd: 5 })
    ).toMatchObject({ kind: "hold", reason: expect.stringContaining("conservative") });
  });

  it("supplies USDC to Vesu, keeping the reserve", () => {
    expect(decide({ action: "supply", to: "vesu_usdc", amount: 50, reason: "7% APY" }, portfolio, { strategy: "conservative", maxTradeUsd: 100 })).toEqual({
      kind: "supply",
      amountUsd: 39,
      reason: "7% APY",
    });
  });

  it("only supplies to the Vesu USDC position", () => {
    expect(decide({ action: "supply", to: "endur_strk", amount: 5, reason: "x" }, portfolio, balanced)).toMatchObject({ kind: "hold" });
  });

  it("withdraws at most the Vesu position", () => {
    expect(decide({ action: "withdraw", from: "vesu_usdc", amount: 50, reason: "x" }, portfolio, { strategy: "balanced", maxTradeUsd: 100 })).toMatchObject({
      kind: "withdraw",
      amountUsd: 20,
    });
    expect(decide({ action: "withdraw", from: "vesu_usdc", amount: 5, reason: "x" }, { ...portfolio, vesuUsd: 0 }, balanced)).toMatchObject({
      kind: "hold",
    });
  });
});

describe("usdToBaseUnits", () => {
  it("converts at the price and rounds down", () => {
    expect(usdToBaseUnits(5, "USDC", 1)).toBe(5_000_000n);
    expect(usdToBaseUnits(3, "ETH", 3000)).toBe(1_000_000_000_000_000n);
    expect(usdToBaseUnits(1, "USDC", 3)).toBe(333_333n);
  });

  it("refuses a missing price", () => {
    expect(() => usdToBaseUnits(1, "ETH", 0)).toThrow(/No price/);
  });
});

describe("spendingPolicies", () => {
  const prices = { USDC: 1, ETH: 3000, STRK: 0.12 };

  it("sets one policy per token, per call = max trade, per day = 4 trades", () => {
    const policies = spendingPolicies(5, prices);
    expect(policies.map((p) => p.token)).toEqual([TOKENS.USDC, TOKENS.ETH, TOKENS.STRK]);
    const usdc = policies[0];
    expect(usdc).toEqual({ token: TOKENS.USDC, maxPerCall: 5_000_000n, maxPerWindow: 20_000_000n, windowSeconds: 86_400 });
  });

  it("gives volatile tokens 1.5x headroom and never a zero window cap", () => {
    const [, eth, strk] = spendingPolicies(5, prices);
    expect(eth.maxPerCall).toBe(2_500_000_000_000_000n); // $7.5 / $3000
    expect(strk.maxPerWindow).toBeGreaterThan(0n);
  });

  it("refuses a max trade below the minimum", () => {
    expect(() => spendingPolicies(0, prices)).toThrow();
  });
});
