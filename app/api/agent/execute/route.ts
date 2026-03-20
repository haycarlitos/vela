import { NextRequest, NextResponse } from "next/server";
import { prepareSwap } from "@/lib/defi/avnu";
import { prepareVesuSupply, prepareVesuWithdraw } from "@/lib/defi/vesu";
import { executeWithSession } from "@/lib/session";
import { logDecision, logSnapshot } from "@/lib/db";
import { getPortfolioState } from "@/lib/defi/portfolio";
import type { AgentAction } from "@/lib/agent-brain";

// POST /api/agent/execute
// Executes a DeFi action decided by the agent brain
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, walletAddress, sessionToken } = body as {
    action: AgentAction;
    walletAddress: string;
    sessionToken: string;
  };

  if (!action || !walletAddress || !sessionToken) {
    return NextResponse.json(
      { error: "action, walletAddress, and sessionToken required" },
      { status: 400 },
    );
  }

  try {
    let txHash: string | undefined;
    let pair: string | undefined;
    let amountUsd: number | undefined;
    let entryPrice: number | undefined;
    let priceImpact: number | undefined;

    if (action.action === "swap") {
      const { calls, quoteResult } = await prepareSwap(
        action.from,
        action.to,
        action.amount,
        walletAddress,
      );

      pair = `${action.from}\u2192${action.to}`;
      amountUsd = quoteResult.sellUsd;
      priceImpact = quoteResult.priceImpactPct;

      // Get entry price for tracking
      const portfolio = await getPortfolioState(walletAddress);
      if (action.to === "ETH") entryPrice = portfolio.prices.ETH;
      else if (action.to === "STRK") entryPrice = portfolio.prices.STRK;
      else entryPrice = 1; // USDC

      const result = await executeWithSession(calls, { walletAddress, sessionToken });
      txHash = result.txHash;
    } else if (action.action === "supply_vesu") {
      const { calls } = prepareVesuSupply(action.amount, walletAddress);
      const result = await executeWithSession(calls, { walletAddress, sessionToken });
      txHash = result.txHash;
      amountUsd = action.amount;
    } else if (action.action === "withdraw_vesu") {
      const { calls } = prepareVesuWithdraw(action.amount, walletAddress);
      const result = await executeWithSession(calls, { walletAddress, sessionToken });
      txHash = result.txHash;
      amountUsd = action.amount;
    }
    // "hold" — no execution needed

    // Log decision
    const decision = await logDecision({
      action: action.action,
      pair,
      amount_usd: amountUsd,
      entry_price: entryPrice,
      quote_price_impact: priceImpact,
      reasoning: action.reason,
      tx_hash: txHash,
    });

    // Take portfolio snapshot
    const portfolio = await getPortfolioState(walletAddress);
    const latestSnapshot = await import("@/lib/db").then((m) => m.getLatestSnapshot());
    const initialDeposit = 10; // TODO: store actual initial deposit
    const pnlUsd = portfolio.totalValueUsd - initialDeposit;
    const pnlPct = (pnlUsd / initialDeposit) * 100;

    const totalX402 = (latestSnapshot?.x402_spent_total ?? 0) + 0.001;

    await logSnapshot({
      total_value_usd: portfolio.totalValueUsd,
      usdc_balance: portfolio.usdc.usd,
      eth_balance: portfolio.eth.usd,
      strk_balance: portfolio.strk.usd,
      vesu_deposited: portfolio.vesuDeposited,
      x402_spent_total: totalX402,
      pnl_usd: pnlUsd,
      pnl_pct: pnlPct,
    });

    return NextResponse.json({
      success: true,
      decision,
      txHash,
      portfolio: {
        totalValueUsd: portfolio.totalValueUsd,
        pnlUsd,
        pnlPct,
      },
    });
  } catch (error) {
    // Log the failed attempt as a hold
    await logDecision({
      action: "hold",
      reasoning: `Execution failed: ${error instanceof Error ? error.message : String(error)}. Original action: ${JSON.stringify(action)}`,
    });

    return NextResponse.json(
      { error: "Execution failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
