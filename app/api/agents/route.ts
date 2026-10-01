import { currentUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { waitForTransaction } from "@chipi-stack/backend";
import { chipi, sessionSecret } from "@/lib/chipi";
import {
  MAX_DEPOSIT_USD,
  MIN_TRADE_USD,
  SESSION_ENTRYPOINTS,
  SESSION_MAX_CALLS,
  SESSION_SECONDS,
} from "@/lib/config";
import { getAgent, recentDecisions, setAgentActive, upsertPendingAgent } from "@/lib/db";
import { CAPPED_TOKENS, isStrategy, spendingPolicies } from "@/lib/policy";
import { getPortfolio, totalUsd } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

const MAX_TRADE_LIMIT_USD = 50;

async function userWallet(userId: string) {
  const wallet = await chipi().getWallet({ externalUserId: userId });
  return wallet ?? null;
}

/** GET: the signed-in user's wallet, portfolio, agent and recent decisions. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const wallet = await userWallet(userId);
  if (!wallet) return NextResponse.json({ wallet: null });

  const [{ portfolio, prices }, agent, decisions] = await Promise.all([
    getPortfolio(wallet.publicKey),
    getAgent(userId),
    recentDecisions(userId),
  ]);

  const session =
    agent && BigInt(agent.wallet_address) === BigInt(wallet.publicKey)
      ? await chipi().sessions.getSessionData({
          walletAddress: wallet.publicKey,
          sessionPublicKey: agent.session_public_key,
        })
      : null;

  return NextResponse.json({
    wallet: { address: wallet.publicKey, walletType: wallet.walletType },
    portfolio,
    prices,
    totalUsd: totalUsd(portfolio),
    depositCapUsd: MAX_DEPOSIT_USD,
    // Never send the encrypted session key to the browser.
    agent: agent && {
      strategy: agent.strategy,
      maxTradeUsd: Number(agent.max_trade_usd),
      sessionPublicKey: agent.session_public_key,
      active: agent.active,
    },
    session,
    decisions: decisions.map((d) => ({
      id: d.id,
      createdAt: d.created_at,
      kind: d.kind,
      fromToken: d.from_token,
      toToken: d.to_token,
      amountUsd: d.amount_usd === null ? null : Number(d.amount_usd),
      reason: d.reason,
      txHash: d.tx_hash,
      success: d.success,
      aiCostUsd: d.ai_cost_usd === null ? null : Number(d.ai_cost_usd),
    })),
  });
}

/**
 * POST { strategy, maxTradeUsd }: create the agent's session key on the server
 * and return exactly what the browser must register with the user's passkey.
 * Nothing is on-chain yet; the agent stays inactive until PATCH confirms it.
 */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { strategy?: unknown; maxTradeUsd?: unknown } | null;
  const strategy = body?.strategy;
  const maxTradeUsd = Number(body?.maxTradeUsd);
  if (!isStrategy(strategy)) return NextResponse.json({ error: "invalid strategy" }, { status: 400 });
  if (!(maxTradeUsd >= MIN_TRADE_USD && maxTradeUsd <= MAX_TRADE_LIMIT_USD)) {
    return NextResponse.json(
      { error: `maxTradeUsd must be between ${MIN_TRADE_USD} and ${MAX_TRADE_LIMIT_USD}` },
      { status: 400 }
    );
  }

  const wallet = await userWallet(userId);
  if (!wallet) return NextResponse.json({ error: "create a wallet first" }, { status: 409 });
  if (wallet.walletType !== "SHHH" && wallet.walletType !== "CHIPI") {
    return NextResponse.json({ error: "this wallet type cannot use session keys" }, { status: 409 });
  }

  const { portfolio, prices } = await getPortfolio(wallet.publicKey);
  if (totalUsd(portfolio) > MAX_DEPOSIT_USD) {
    return NextResponse.json(
      { error: `The agent manages wallets up to $${MAX_DEPOSIT_USD} (MAX_DEPOSIT_USD)` },
      { status: 403 }
    );
  }

  const session = chipi().sessions.createSessionKey({
    encryptKey: sessionSecret(),
    durationSeconds: SESSION_SECONDS,
  });
  const policies = spendingPolicies(maxTradeUsd, prices);

  await upsertPendingAgent({
    userId,
    walletAddress: wallet.publicKey,
    strategy,
    maxTradeUsd,
    sessionPublicKey: session.publicKey,
    sessionEncryptedKey: session.encryptedPrivateKey,
    sessionValidUntil: session.validUntil,
  });

  return NextResponse.json({
    sessionPublicKey: session.publicKey,
    validUntil: session.validUntil,
    maxCalls: SESSION_MAX_CALLS,
    allowedEntrypoints: SESSION_ENTRYPOINTS,
    // bigint does not survive JSON; the browser converts these back.
    spendingPolicies: policies.map((p) => ({
      token: p.token,
      maxPerCall: p.maxPerCall.toString(),
      maxPerWindow: p.maxPerWindow.toString(),
      windowSeconds: p.windowSeconds,
    })),
  });
}

/**
 * PATCH { sessionPublicKey, txHash, active }: the browser registered (or revoked)
 * the session. Vela waits for that transaction and, to activate, checks the
 * chain itself: the browser's word is not enough.
 */
export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    sessionPublicKey?: unknown;
    txHash?: unknown;
    active?: unknown;
  } | null;
  const { sessionPublicKey, txHash, active } = body ?? {};
  if (typeof sessionPublicKey !== "string" || typeof active !== "boolean") {
    return NextResponse.json({ error: "sessionPublicKey and active are required" }, { status: 400 });
  }

  const agent = await getAgent(userId);
  if (!agent || agent.session_public_key !== sessionPublicKey) {
    return NextResponse.json({ error: "unknown session" }, { status: 404 });
  }

  if (!active) {
    // Stopping never needs proof: the safe direction.
    await setAgentActive(userId, sessionPublicKey, false);
    return NextResponse.json({ active: false });
  }

  if (typeof txHash !== "string") return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  const receipt = await waitForTransaction(txHash, { timeoutMs: 120_000 });
  if (!receipt.success) {
    return NextResponse.json({ error: `registration reverted: ${receipt.revertReason ?? "unknown"}` }, { status: 409 });
  }
  const onChain = await chipi().sessions.getSessionData({
    walletAddress: agent.wallet_address,
    sessionPublicKey,
  });
  if (!onChain.isActive) return NextResponse.json({ error: "session is not active on-chain" }, { status: 409 });

  // Every token the wallet can hold must be capped on-chain (a window of 0 means no cap).
  for (const token of CAPPED_TOKENS) {
    const policy = await chipi().sessions.getSpendingPolicy({ walletAddress: agent.wallet_address, sessionPublicKey, token });
    if (policy.maxPerWindow === 0n) {
      return NextResponse.json({ error: `the session has no spending cap for ${token}` }, { status: 409 });
    }
  }

  await setAgentActive(userId, sessionPublicKey, true);
  return NextResponse.json({ active: true, session: onChain });
}
