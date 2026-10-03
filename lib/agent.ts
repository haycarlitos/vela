import "server-only";
import { waitForTransaction, type SessionKeyData } from "@chipi-stack/backend";
import { hash, type Call } from "starknet";
import { chipi, sessionSecret } from "./chipi";
import { logDecision, setAgentActive, type AgentRow } from "./db";
import { aiCostUsd, think } from "./brain";
import { decide, usdToBaseUnits, type Action } from "./policy";
import { callContract, getPortfolio, totalUsd } from "./portfolio";
import { MAX_DEPOSIT_USD, VESU_USDC_VAULT, payAiWithX402 } from "./config";
import { legacyVesuDepositCalls, legacyVesuWithdrawCalls, vesuDepositCalls, vesuSharesFor, vesuWithdrawCalls } from "./vesu";

export interface TickResult {
  userId: string;
  outcome: "stopped" | "hold" | "executed" | "failed";
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
 *   session live? → portfolio → think → policy → execute with the session key
 *   → wait for the receipt.
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
  if (totalUsd(portfolio) > MAX_DEPOSIT_USD) {
    // Checked at hire time too, but the user can deposit more later.
    const reason = `The wallet holds more than $${MAX_DEPOSIT_USD} (MAX_DEPOSIT_USD): the agent waits`;
    await logDecision({ userId, kind: "hold", reason });
    return { userId, outcome: "hold", detail: reason };
  }

  // 3. Think, then let the policy decide.
  const strategy = agent.strategy;
  const maxTradeUsd = Number(agent.max_trade_usd);
  // Paid from Chipi credits, or per call from the session when Chipi asks (module 12).
  const thought = await think(portfolio, strategy, maxTradeUsd, payAiWithX402() ? { wallet, session } : undefined);
  const { decision } = thought;
  const aiCost = aiCostUsd(thought);
  const action = decide(decision, portfolio, { strategy, maxTradeUsd });

  if (action.kind === "hold") {
    await logDecision({ userId, kind: "hold", reason: action.reason, aiCostUsd: aiCost });
    return { userId, outcome: "hold", detail: action.reason };
  }

  // 4. Execute with the session key and wait for the receipt: a hash is not a result.
  const calls = await callsFor(action, wallet.publicKey, session.publicKey, prices.USDC);
  const txHash = await sdk.executeTransactionWithSession({
    params: { encryptKey: sessionSecret(), wallet, session, calls },
  });
  const receipt = await waitForTransaction(txHash, { timeoutMs: 120_000 }).catch(async (err: unknown) => {
    // Sent, but no receipt yet: record the hash anyway, so the trade is never invisible.
    const detail = `No receipt after 2 minutes: ${err instanceof Error ? err.message : String(err)}`;
    await logDecision({ userId, kind: action.kind, amountUsd: action.amountUsd, reason: detail, txHash, aiCostUsd: aiCost });
    return null;
  });
  if (!receipt) return { userId, outcome: "failed", detail: "no receipt yet", txHash };
  const failure = !receipt.success
    ? receipt.revertReason ?? "reverted"
    : !movedFunds(receipt.events, wallet.publicKey)
      ? BLOCKED
      : null;

  await logDecision({
    userId,
    kind: action.kind,
    fromToken: action.kind === "swap" ? action.from : action.kind === "withdraw" ? "vesu_usdc" : "USDC",
    toToken: action.kind === "swap" ? action.to : action.kind === "supply" ? "vesu_usdc" : "USDC",
    amountUsd: action.amountUsd,
    reason: failure ? `Failed: ${failure}` : action.reason,
    txHash,
    success: !failure,
    aiCostUsd: aiCost,
  });
  return {
    userId,
    outcome: failure ? "failed" : "executed",
    detail: failure ?? `${action.kind} $${action.amountUsd}`,
    txHash,
  };
}

const TRANSFER = BigInt(hash.getSelectorFromName("Transfer"));
const BLOCKED = "blocked by the wallet (cap, whitelist or ended session): nothing moved";

/**
 * Did any token move into or out of the wallet? On SHHH a call the wallet
 * refuses (over a cap, not whitelisted, revoked session) still comes back
 * SUCCEEDED: the paymaster's transaction ran, the wallet's call did not.
 * Every swap, supply and withdraw moves a token, so no Transfer means it failed.
 */
export function movedFunds(events: { keys: string[]; data: string[] }[], wallet: string): boolean {
  const me = BigInt(wallet);
  return events.some(
    (e) =>
      BigInt(e.keys[0] ?? 0) === TRANSFER &&
      // from and to are keys (Cairo 1 tokens) or the first two data felts (older tokens)
      [e.keys[1], e.keys[2], e.data[0], e.data[1]].some((f) => f !== undefined && BigInt(f) === me),
  );
}

async function callsFor(
  action: Exclude<Action, { kind: "hold" }>,
  wallet: string,
  sessionPublicKey: string,
  usdcPrice: number
): Promise<Call[]> {
  if (action.kind === "supply" || action.kind === "withdraw") {
    const assets = usdToBaseUnits(action.amountUsd, "USDC", usdcPrice);
    // Sessions hired before the router cap the vault shares at one unit and
    // whitelist the vault's own deposit/withdraw: keep calling those.
    const shares = await chipi().sessions.getSpendingPolicy({ walletAddress: wallet, sessionPublicKey, token: VESU_USDC_VAULT });
    const legacy = shares.maxPerCall <= 1n;
    if (action.kind === "supply") return legacy ? legacyVesuDepositCalls(assets, wallet) : vesuDepositCalls(assets);
    return legacy ? legacyVesuWithdrawCalls(assets, wallet) : vesuWithdrawCalls(assets, await vesuSharesFor(callContract, assets));
  }
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
