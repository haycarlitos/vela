import { describe, it, expect, vi, beforeEach } from "vitest";

const ai = { think: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("../chipi", () => ({ chipi: () => ({ ai }), sessionSecret: () => "s".repeat(32) }));

import { aiCostUsd, think } from "../brain";
import { X402_MAX_PRICE_USDC, sessionEntrypoints } from "../config";

const portfolio = { USDC: { balance: 10, usd: 10 }, ETH: { balance: 0, usd: 0 }, STRK: { balance: 0, usd: 0 }, vesuUsd: 0 };

describe("think", () => {
  beforeEach(() => ai.think.mockReset().mockResolvedValue({}));

  it("without a payment, calls think with no options (credits)", async () => {
    await think(portfolio, "balanced", 1);
    expect(ai.think.mock.calls[0][1]).toEqual({});
  });

  it("with a payment, lets the SDK pay a 402 from the session, capped at X402_MAX_PRICE_USDC", async () => {
    const wallet = { publicKey: "0xabc", encryptedPrivateKey: "enc" };
    const session = { publicKey: "0x5e5", encryptedPrivateKey: "sess", validUntil: 1 };
    await think(portfolio, "balanced", 1, { wallet, session });
    expect(ai.think.mock.calls[0][1]).toEqual({
      payWithSession: { encryptKey: "s".repeat(32), wallet, session, maxAmount: X402_MAX_PRICE_USDC },
    });
  });
});

describe("aiCostUsd", () => {
  it("is the credits charge, or the x402 amount when the call was paid on-chain", () => {
    expect(aiCostUsd({ cost: { charged: 0.002, currency: "USD" } })).toBe(0.002);
    expect(
      aiCostUsd({
        cost: { charged: 0, currency: "USD" },
        x402Payment: { transactionHash: "0x1", payer: "0x2", amount: "15000", asset: "0x3" },
      })
    ).toBe(0.015);
  });
});

describe("sessionEntrypoints", () => {
  it("adds transfer only when the agent pays for AI over x402", () => {
    delete process.env.VELA_PAY_AI_WITH_X402;
    expect(sessionEntrypoints()).not.toContain("transfer");
    process.env.VELA_PAY_AI_WITH_X402 = "true";
    expect(sessionEntrypoints()).toEqual(["approve", "multi_route_swap", "deposit_to_self", "withdraw_to_self", "transfer"]);
    delete process.env.VELA_PAY_AI_WITH_X402;
  });
});
