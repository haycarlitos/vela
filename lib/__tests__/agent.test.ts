import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const calls: string[] = [];

const sdk = {
  getWallet: vi.fn(),
  sessions: { getSessionData: vi.fn(), getSpendingPolicy: vi.fn() },
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
vi.mock("../portfolio", async (orig) => ({ ...(await orig<typeof import("../portfolio")>()), getPortfolio: vi.fn(), callContract: vi.fn() }));
vi.mock("../brain", async (orig) => ({ ...(await orig<typeof import("../brain")>()), think: vi.fn() }));
vi.mock("@chipi-stack/backend", async (orig) => ({
  ...(await orig<typeof import("@chipi-stack/backend")>()),
  waitForTransaction: vi.fn(),
}));

import { hash } from "starknet";
import { movedFunds, runTick } from "../agent";
import { logDecision, setAgentActive, type AgentRow } from "../db";
import { callContract, getPortfolio } from "../portfolio";
import { VESU_ROUTER, VESU_USDC_VAULT } from "../config";
import { think } from "../brain";
import { waitForTransaction } from "@chipi-stack/backend";

const WALLET = { publicKey: "0x0abc", encryptedPrivateKey: "enc", walletType: "SHHH" };
const TRANSFER = hash.getSelectorFromName("Transfer");
const APPROVAL = hash.getSelectorFromName("Approval");

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
  // A session hired with the router: the vault shares have a real cap.
  sdk.sessions.getSpendingPolicy.mockResolvedValue({ maxPerCall: 5_250_000n * 10n ** 12n, maxPerWindow: 1n, windowSeconds: 86_400, spentInWindow: 0n, windowStart: 0 });
  vi.mocked(callContract).mockResolvedValue(["0x2b5e3af16b1880000", "0x0"]); // preview_withdraw: 50e18 shares
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
  vi.mocked(waitForTransaction).mockResolvedValue({
    transactionHash: "0xtrade",
    success: true,
    events: [{ from_address: "0xusdc", keys: [TRANSFER, "0x0abc", "0xde5"], data: ["0x1", "0x0"] }],
  } as never);
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

  it("records a succeeded transaction that moved nothing as a failure", async () => {
    vi.mocked(think).mockResolvedValue({
      decision: { action: "supply", to: "vesu_usdc", amount: 3, reason: "yield" },
      cost: { charged: 0.001, currency: "USD" },
    } as never);
    // What mainnet returns when the wallet blocks a session call: success, and only the paymaster's fee transfer.
    vi.mocked(waitForTransaction).mockResolvedValue({
      transactionHash: "0xtrade",
      success: true,
      events: [{ from_address: "0xstrk", keys: [TRANSFER, "0x4d38", "0x1176"], data: ["0xa5e7", "0x0"] }],
    } as never);

    const result = await runTick(agent);

    expect(result).toMatchObject({ outcome: "failed", detail: expect.stringContaining("nothing moved") });
    expect(logDecision).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "supply", success: false }));
  });
});

describe("paying for AI", () => {
  afterEach(() => {
    delete process.env.VELA_PAY_AI_WITH_X402;
  });

  it("uses credits by default: think gets no payment", async () => {
    await runTick(agent);
    expect(vi.mocked(think).mock.calls[0][3]).toBeUndefined();
    expect(logDecision).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "hold", aiCostUsd: 0.0012 }));
  });

  it("with VELA_PAY_AI_WITH_X402, think may pay from the session and the x402 amount is logged as the cost", async () => {
    process.env.VELA_PAY_AI_WITH_X402 = "true";
    vi.mocked(think).mockResolvedValue({
      decision: { action: "hold", reason: "quiet" },
      cost: { charged: 0, currency: "USD" },
      x402Payment: { transactionHash: "0xpay", payer: "0x0abc", amount: "15000", asset: "0xusdc" },
    } as never);

    await runTick(agent);

    expect(vi.mocked(think).mock.calls[0][3]).toEqual({
      wallet: WALLET,
      session: { publicKey: "0x5e5", encryptedPrivateKey: "sess-enc", validUntil: 1900000000 },
    });
    expect(logDecision).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "hold", aiCostUsd: 0.015 }));
  });
});

describe("Vesu calls", () => {
  const supply = { action: "supply", to: "vesu_usdc", amount: 3, reason: "yield" };
  const withdraw = { action: "withdraw", from: "vesu_usdc", amount: 2, reason: "risk off" };
  const sent = () => sdk.executeTransactionWithSession.mock.calls[0][0].params.calls;
  const thinks = (decision: object) =>
    vi.mocked(think).mockResolvedValue({ decision, cost: { charged: 0.001, currency: "USD" } } as never);

  it("supplies through the router: approve USDC to it, then deposit_to_self", async () => {
    thinks(supply);
    await runTick(agent);
    expect(sent()).toEqual([
      { contractAddress: expect.any(String), entrypoint: "approve", calldata: [VESU_ROUTER, "0x2dc6c0", "0x0"] },
      { contractAddress: VESU_ROUTER, entrypoint: "deposit_to_self", calldata: ["0x2dc6c0", "0x0"] },
    ]);
  });

  it("withdraws through the router: approve the shares preview_withdraw asks for, then withdraw_to_self", async () => {
    thinks(withdraw);
    vi.mocked(getPortfolio).mockResolvedValue({ portfolio: { ...portfolio, vesuUsd: 10 }, prices: { USDC: 1, ETH: 3000, STRK: 0.12 } });
    await runTick(agent);
    expect(callContract).toHaveBeenCalledWith({ contractAddress: VESU_USDC_VAULT, entrypoint: "preview_withdraw", calldata: ["0x1e8480", "0x0"] });
    expect(sent()).toEqual([
      { contractAddress: VESU_USDC_VAULT, entrypoint: "approve", calldata: [VESU_ROUTER, "0x2b5e3af16b1880000", "0x0"] },
      { contractAddress: VESU_ROUTER, entrypoint: "withdraw_to_self", calldata: ["0x1e8480", "0x0"] },
    ]);
  });

  it("keeps the vault's own calls for a session hired before the router (shares capped at one unit)", async () => {
    sdk.sessions.getSpendingPolicy.mockResolvedValue({ maxPerCall: 1n, maxPerWindow: 1n, windowSeconds: 86_400, spentInWindow: 0n, windowStart: 0 });
    thinks(supply);
    await runTick(agent);
    expect(sent().map((c: { entrypoint: string }) => c.entrypoint)).toEqual(["approve", "deposit"]);
    expect(sent()[1].contractAddress).toBe(VESU_USDC_VAULT);
  });
});

describe("movedFunds", () => {
  it("finds a Transfer from or to the wallet, in keys or in data", () => {
    expect(movedFunds([{ keys: [TRANSFER, "0xabc", "0x9"], data: ["0x1", "0x0"] }], "0x0abc")).toBe(true);
    expect(movedFunds([{ keys: [TRANSFER, "0x9", "0xabc"], data: ["0x1", "0x0"] }], "0xabc")).toBe(true);
    expect(movedFunds([{ keys: [TRANSFER], data: ["0xabc", "0x9", "0x1", "0x0"] }], "0xabc")).toBe(true);
  });

  it("ignores other events and other wallets' transfers", () => {
    expect(movedFunds([{ keys: [APPROVAL, "0xabc", "0xabc"], data: ["0x1", "0x0"] }], "0xabc")).toBe(false);
    expect(movedFunds([{ keys: [TRANSFER, "0x4d38", "0x1176"], data: ["0x1", "0x0"] }], "0xabc")).toBe(false);
    expect(movedFunds([], "0xabc")).toBe(false);
  });
});
