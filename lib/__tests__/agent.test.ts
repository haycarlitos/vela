import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: string[] = [];

const sdk = {
  getWallet: vi.fn(),
  sessions: { getSessionData: vi.fn() },
  executeTransactionWithSession: vi.fn(),
  ai: { execute: vi.fn() },
};

vi.mock("server-only", () => ({}));
vi.mock("../chipi", () => ({
  chipi: () => sdk,
  sessionSecret: () => "s".repeat(32),
  treasuryAddress: () => "0x7ea",
}));
vi.mock("../db", () => ({
  logDecision: vi.fn(async () => {}),
  setAgentActive: vi.fn(async () => true),
}));
vi.mock("../portfolio", () => ({ getPortfolio: vi.fn() }));
vi.mock("../brain", () => ({ think: vi.fn() }));
vi.mock("../payments", () => ({ verifyThinkPayment: vi.fn() }));
vi.mock("@chipi-stack/backend", async (orig) => ({
  ...(await orig<typeof import("@chipi-stack/backend")>()),
  waitForTransaction: vi.fn(),
}));

import { runTick } from "../agent";
import { logDecision, setAgentActive, type AgentRow } from "../db";
import { getPortfolio } from "../portfolio";
import { think } from "../brain";
import { verifyThinkPayment } from "../payments";
import { waitForTransaction } from "@chipi-stack/backend";

const WALLET = { publicKey: "0x0abc", encryptedPrivateKey: "enc", walletType: "SHHH" };

const agent: AgentRow = {
  user_id: "user_1",
  wallet_address: "0xabc",
  strategy: "balanced",
  max_trade_usd: "5",
  session_public_key: "0x5e5",
  session_encrypted_key: "sess-enc",
  session_valid_until: "1900000000",
  active: true,
};

const portfolio = {
  USDC: { balance: 40, usd: 40 },
  ETH: { balance: 0.01, usd: 30 },
  STRK: { balance: 100, usd: 12 },
  vesuUsd: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  sdk.getWallet.mockResolvedValue(WALLET);
  sdk.sessions.getSessionData.mockResolvedValue({ isActive: true, validUntil: 1900000000, remainingCalls: 900, allowedEntrypoints: [] });
  vi.mocked(getPortfolio).mockResolvedValue({ portfolio, prices: { USDC: 1, ETH: 3000, STRK: 0.12 } });
  sdk.executeTransactionWithSession.mockImplementation(async ({ params }) => {
    calls.push(params.calls[0].entrypoint);
    return params.calls[0].entrypoint === "transfer" ? "0xpay" : "0xtrade";
  });
  vi.mocked(verifyThinkPayment).mockImplementation(async (proof) => {
    calls.push("verify");
    return { valid: true, transactionHash: proof.transactionHash, amount: 1000n };
  });
  vi.mocked(think).mockImplementation(async () => {
    calls.push("think");
    return { decision: { action: "hold", reason: "quiet" }, cost: { charged: 0.0012, currency: "USD" } } as never;
  });
  vi.mocked(waitForTransaction).mockResolvedValue({ transactionHash: "0xtrade", success: true, events: [] });
});

describe("runTick", () => {
  it("pays, has the payment verified, then thinks: in that order", async () => {
    const result = await runTick(agent);
    expect(calls).toEqual(["transfer", "verify", "think"]);
    expect(result).toMatchObject({ outcome: "hold", detail: "quiet" });
    expect(sdk.executeTransactionWithSession.mock.calls[0][0].params).toMatchObject({
      encryptKey: "s".repeat(32),
      wallet: WALLET,
      session: { publicKey: "0x5e5", encryptedPrivateKey: "sess-enc", validUntil: 1900000000 },
      calls: [{ entrypoint: "transfer", calldata: ["0x7ea", "0x3e8", "0x0"] }],
    });
    expect(verifyThinkPayment).toHaveBeenCalledWith({ transactionHash: "0xpay", from: "0x0abc" });
    expect(logDecision).toHaveBeenCalledWith(expect.objectContaining({ kind: "hold", paymentTxHash: "0xpay", aiCostUsd: 0.0012 }));
  });

  it("stops the agent when the session is no longer active on-chain, without paying", async () => {
    sdk.sessions.getSessionData.mockResolvedValue({ isActive: false, validUntil: 0, remainingCalls: 0, allowedEntrypoints: [] });
    const result = await runTick(agent);
    expect(result.outcome).toBe("stopped");
    expect(setAgentActive).toHaveBeenCalledWith("user_1", "0x5e5", false);
    expect(sdk.executeTransactionWithSession).not.toHaveBeenCalled();
  });

  it("stops when the user's wallet changed", async () => {
    sdk.getWallet.mockResolvedValue({ ...WALLET, publicKey: "0xdef" });
    expect((await runTick(agent)).outcome).toBe("stopped");
    expect(sdk.executeTransactionWithSession).not.toHaveBeenCalled();
  });

  it("does not think when the payment is rejected", async () => {
    vi.mocked(verifyThinkPayment).mockResolvedValue({ valid: false, transactionHash: "0xpay", reason: "ALREADY_USED" });
    const result = await runTick(agent);
    expect(result).toMatchObject({ outcome: "failed", detail: "payment ALREADY_USED" });
    expect(think).not.toHaveBeenCalled();
  });

  it("skips without paying when USDC cannot cover a decision", async () => {
    vi.mocked(getPortfolio).mockResolvedValue({ portfolio: { ...portfolio, USDC: { balance: 0, usd: 0 } }, prices: { USDC: 1, ETH: 3000, STRK: 0.12 } });
    expect((await runTick(agent)).outcome).toBe("skipped");
    expect(sdk.executeTransactionWithSession).not.toHaveBeenCalled();
  });

  it("executes a capped swap built by the AI API and records the receipt", async () => {
    vi.mocked(think).mockResolvedValue({
      decision: { action: "swap", from: "USDC", to: "ETH", amount: 50, reason: "RSI 28" },
      cost: { charged: 0.001, currency: "USD" },
    } as never);
    sdk.ai.execute.mockResolvedValue({ calls: [{ contractAddress: "0xusdc", entrypoint: "approve", calldata: [] }] });

    const result = await runTick(agent);

    expect(sdk.ai.execute).toHaveBeenCalledWith(expect.objectContaining({ from: "USDC", to: "ETH", amountUsd: 5, walletAddress: "0x0abc" }));
    expect(result).toMatchObject({ outcome: "executed", txHash: "0xtrade" });
    expect(logDecision).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "swap", amountUsd: 5, success: true, txHash: "0xtrade" }));
  });

  it("records a revert as a failure, not a success", async () => {
    vi.mocked(think).mockResolvedValue({
      decision: { action: "supply", to: "vesu_usdc", amount: 3, reason: "yield" },
      cost: { charged: 0.001, currency: "USD" },
    } as never);
    vi.mocked(waitForTransaction).mockResolvedValue({ transactionHash: "0xtrade", success: false, revertReason: "Spending: exceeds per-call", events: [] });

    const result = await runTick(agent);

    expect(result).toMatchObject({ outcome: "failed", detail: "Spending: exceeds per-call" });
    expect(logDecision).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "supply", success: false }));
  });
});
