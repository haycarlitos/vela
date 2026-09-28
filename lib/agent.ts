import "server-only";
import { waitForTransaction, type SessionKeyData } from "@chipi-stack/backend";
import type { Call } from "starknet";
import { chipi, sessionSecret, treasuryAddress } from "./chipi";
import { THINK_PRICE_BASE_UNITS } from "./config";
import { logDecision, setAgentActive, type AgentRow } from "./db";
import { think } from "./brain";
import { decide, usdToBaseUnits, type Action } from "./policy";
import { getPortfolio } from "./portfolio";
import { verifyThinkPayment } from "./payments";
import { vesuDepositCalls, vesuWithdrawCalls } from "./vesu";
import { paymentCall } from "./x402";

export interface TickResult {
  userId: string;
  outcome: "stopped" | "skipped" | "hold" | "executed" | "failed";
  detail: string;
  txHash?: string;
}

function sessionOf(agent: AgentRow): SessionKeyData {
  return {
    publicKey: agent.session_public_key,
    encryptedPrivateKey: agent.session_encrypted_key,
    validUntil: Number(agent.session_valid_until),
  };
}

/**
 * One cycle for one agent:
 *   session live? → portfolio → pay for the decision (x402, verified on-chain)
 *   → think → policy → execute with the session key → wait for the receipt.
 *
 * The agent only ever signs with its session key. Everything it can do is
 * bounded on-chain by the session's whitelist and spending policies.
 */
export async function runTick(agent: AgentRow): Promise<TickResult> {
  const sdk = chipi();
  const userId = agent.user_id;
  const session = sessionOf(agent);

  const wallet = await sdk.getWallet({ externalUserId: userId });
  if (!wallet || BigInt(wallet.publicKey) !== BigInt(agent.wallet_address)) {
    await setAgentActive(userId, session.publicKey, false);
    return { userId, outcome: "stopped", detail: "wallet not found or changed" };
  }

  // 1. The chain is the source of truth: expired, revoked or out of calls stops the agent.
  const onChain = await sdk.sessions.getSessionData({
    walletAddress: wallet.publicKey,
    sessionPublicKey: session.publicKey,
  });
  if (!onChain.isActive) {
    await setAgentActive(userId, session.publicKey, false);
    await logDecision({ userId, kind: "stopped", reason: "Session expired, revoked or out of calls" });
    return { userId, outcome: "stopped", detail: "session not active on-chain" };
  }

  // 2. Portfolio
  const { portfolio, prices } = await getPortfolio(wallet.publicKey);
  const priceUsd = Number(THINK_PRICE_BASE_UNITS) / 1e6;
  if (portfolio.USDC.usd < priceUsd) {
    return { userId, outcome: "skipped", detail: "not enough USDC to pay for a decision" };
  }

  // 3. Pay for the decision with the session key, and verify it like any other payer.
  const paymentTx = await sdk.executeTransactionWithSession({
    params: { encryptKey: sessionSecret(), wallet, session, calls: [paymentCall(treasuryAddress())] },
  });
  const payment = await verifyThinkPayment({ transactionHash: paymentTx, from: wallet.publicKey });
  if (!payment.valid) {
    await logDecision({ userId, kind: "failed", reason: `Payment rejected: ${payment.reason}`, paymentTxHash: paymentTx });
    return { userId, outcome: "failed", detail: `payment ${payment.reason}`, txHash: paymentTx };
  }

  // 4. Think, then let the policy decide.
  const strategy = agent.strategy;
  const maxTradeUsd = Number(agent.max_trade_usd);
  const { decision, cost } = await think(portfolio, strategy, maxTradeUsd);
  const action = decide(decision, portfolio, { strategy, maxTradeUsd });

  if (action.kind === "hold") {
    await logDecision({ userId, kind: "hold", reason: action.reason, paymentTxHash: paymentTx, aiCostUsd: cost.charged });
    return { userId, outcome: "hold", detail: action.reason };
  }

  // 5. Execute with the session key and wait for the receipt: a hash is not a result.
  const calls = await callsFor(action, wallet.publicKey, prices.USDC);
  const txHash = await sdk.executeTransactionWithSession({
    params: { encryptKey: sessionSecret(), wallet, session, calls },
  });
  const receipt = await waitForTransaction(txHash, { timeoutMs: 120_000 });

  await logDecision({
    userId,
    kind: action.kind,
    fromToken: action.kind === "swap" ? action.from : action.kind === "withdraw" ? "vesu_usdc" : "USDC",
    toToken: action.kind === "swap" ? action.to : action.kind === "supply" ? "vesu_usdc" : "USDC",
    amountUsd: action.amountUsd,
    reason: receipt.success ? action.reason : `Reverted: ${receipt.revertReason ?? "unknown"}`,
    txHash,
    success: receipt.success,
    paymentTxHash: paymentTx,
    aiCostUsd: cost.charged,
  });
  return {
    userId,
    outcome: receipt.success ? "executed" : "failed",
    detail: receipt.success ? `${action.kind} $${action.amountUsd}` : receipt.revertReason ?? "reverted",
    txHash,
  };
}

async function callsFor(action: Exclude<Action, { kind: "hold" }>, wallet: string, usdcPrice: number): Promise<Call[]> {
  if (action.kind === "supply") return vesuDepositCalls(usdToBaseUnits(action.amountUsd, "USDC", usdcPrice), wallet);
  if (action.kind === "withdraw") return vesuWithdrawCalls(usdToBaseUnits(action.amountUsd, "USDC", usdcPrice), wallet);
  const { calls } = await chipi().ai.execute({
    chain: "starknet",
    action: "swap",
    from: action.from,
    to: action.to,
    amountUsd: action.amountUsd,
    walletAddress: wallet,
    slippage: 0.01,
  });
  return calls;
}
