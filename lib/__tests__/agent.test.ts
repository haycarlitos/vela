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
}));
vi.mock("../db", () => ({
  logDecision: vi.fn(async () => {}),
  setAgentActive: vi.fn(async () => true),
}));
vi.mock("../portfolio", async (orig) => ({ ...(await orig<typeof import("../portfolio")>()), getPortfolio: vi.fn() }));
vi.mock("../brain", () => ({ think: vi.fn() }));
vi.mock("@chipi-stack/backend", async (orig) => ({
  ...(await orig<typeof import("@chipi-stack/backend")>()),
  waitForTransaction: vi.fn(),
}));

import { runTick } from "../agent";
import { logDecision, setAgentActive, type AgentRow } from "../db";
import { getPortfolio } from "../portfolio";
import { think } from "../brain";
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
    return "0xtrade";
  });
  vi.mocked(think).mockImplementation(async () => {
    calls.push("think");
    return { decision: { action: "hold", reason: "quiet" }, cost: { charged: 0.0012, currency: "USD" } } as never;
  });
  vi.mocked(waitForTransaction).mockResolvedValue({ transactionHash: "0xtrade", success: true, events: [] });
});

describe("runTick", () => {
  it("thinks and records a hold without sending any transaction", async () => {
    const result = await runTick(agent);
    expect(calls).toEqual(["think"]);
    expect(result).toMatchObject({ outcome: "hold", detail: "quiet" });
    expect(sdk.executeTransactionWithSession).not.toHaveBeenCalled();
    expect(logDecision).toHaveBeenCalledWith(expect.objectContaining({ kind: "hold", aiCostUsd: 0.0012 }));
  });

  it("stops the agent when the session is no longer active on-chain, without thinking", async () => {
    sdk.sessions.getSessionData.mockResolvedValue({ isActive: false, validUntil: 0, remainingCalls: 0, allowedEntrypoints: [] });
    const result = await runTick(agent);
    expect(result.outcome).toBe("stopped");
    expect(setAgentActive).toHaveBeenCalledWith("user_1", "0x5e5", false);
    expect(sdk.executeTransactionWithSession).not.toHaveBeenCalled();
    expect(think).not.toHaveBeenCalled();
  });

  it("stops when the user's wallet changed", async () => {
    sdk.getWallet.mockResolvedValue({ ...WALLET, publicKey: "0xdef" });
    expect((await runTick(agent)).outcome).toBe("stopped");
    expect(sdk.executeTransactionWithSession).not.toHaveBeenCalled();
  });

  it("waits, without thinking, when the wallet grew past MAX_DEPOSIT_USD after hiring", async () => {
    vi.mocked(getPortfolio).mockResolvedValue({ portfolio: { ...portfolio, USDC: { balance: 500, usd: 500 } }, prices: { USDC: 1, ETH: 3000, STRK: 0.12 } });
    const result = await runTick(agent);
    expect(result.outcome).toBe("hold");
    expect(think).not.toHaveBeenCalled();
    expect(sdk.executeTransactionWithSession).not.toHaveBeenCalled();
  });

  it("records the hash of a trade whose receipt does not arrive", async () => {
    vi.mocked(think).mockResolvedValue({
      decision: { action: "supply", to: "vesu_usdc", amount: 3, reason: "yield" },
      cost: { charged: 0.001, currency: "USD" },
    } as never);
    vi.mocked(waitForTransaction).mockRejectedValue(new Error("timeout"));
    const result = await runTick(agent);
    expect(result).toMatchObject({ outcome: "failed", txHash: "0xtrade" });
    expect(logDecision).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "supply", txHash: "0xtrade", reason: expect.stringContaining("No receipt") }));
  });

  it("signs trades with the session key only", async () => {
    vi.mocked(think).mockResolvedValue({
      decision: { action: "swap", from: "USDC", to: "ETH", amount: 5, reason: "dip" },
      cost: { charged: 0.001, currency: "USD" },
    } as never);
    sdk.ai.execute.mockResolvedValue({ calls: [{ contractAddress: "0xusdc", entrypoint: "approve", calldata: [] }] });
    await runTick(agent);
    expect(sdk.executeTransactionWithSession.mock.calls[0][0].params).toMatchObject({
      encryptKey: "s".repeat(32),
      wallet: WALLET,
      session: { publicKey: "0x5e5", encryptedPrivateKey: "sess-enc", validUntil: 1900000000 },
    });
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
