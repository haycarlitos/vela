import { NextRequest, NextResponse } from "next/server";
import { getAgentDecision, evaluateOpenPositions } from "@/lib/agent-brain";
import { getPortfolioState, getVesuUsdcApy, getPriceChanges } from "@/lib/defi/portfolio";
import {
  getRecentDecisions,
  getOpenSwapDecisions,
  markOutcome,
  logDecision,
  logSnapshot,
  getLatestSnapshot,
} from "@/lib/db";
import { prepareSwap } from "@/lib/defi/avnu";
import { prepareVesuSupply, prepareVesuWithdraw } from "@/lib/defi/vesu";
import { executeWithSession } from "@/lib/session";

// Vercel cron handler — runs every 30 minutes
// vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "*/30 * * * *" }] }
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: In production, iterate over active agents (users with active sessions)
  // For now, single-agent mode with env vars
  const walletAddress = process.env.AGENT_WALLET_ADDRESS;
  const sessionToken = process.env.AGENT_SESSION_TOKEN;

  if (!walletAddress || !sessionToken) {
    return NextResponse.json({ error: "Agent not configured" }, { status: 500 });
  }

  try {
    // 1. Fetch all data
    const [portfolio, vesuApy, priceChanges, recentDecisions, openDecisions] = await Promise.all([
      getPortfolioState(walletAddress),
      getVesuUsdcApy(),
      getPriceChanges(),
      getRecentDecisions(20),
      getOpenSwapDecisions(),
    ]);

    // 2. Evaluate open positions
    await evaluateOpenPositions(
      openDecisions,
      { ETH: portfolio.prices.ETH, STRK: portfolio.prices.STRK, USDC: 1 },
      markOutcome,
    );

    // 3. Ask Claude for a decision
    const action = await getAgentDecision(portfolio, recentDecisions, vesuApy, priceChanges);

    // 4. Execute the decision
    let txHash: string | undefined;
    let pair: string | undefined;
    let amountUsd: number | undefined;
    let entryPrice: number | undefined;
    let priceImpact: number | undefined;

    if (action.action === "swap") {
      try {
        const { calls, quoteResult } = await prepareSwap(
          action.from,
          action.to,
          action.amount,
          walletAddress,
        );
        pair = `${action.from}\u2192${action.to}`;
        amountUsd = quoteResult.sellUsd;
        priceImpact = quoteResult.priceImpactPct;
        if (action.to === "ETH") entryPrice = portfolio.prices.ETH;
        else if (action.to === "STRK") entryPrice = portfolio.prices.STRK;
        else entryPrice = 1;

        const result = await executeWithSession(calls, { walletAddress, sessionToken });
        txHash = result.txHash;
      } catch (error) {
        // Log failed execution as hold
        await logDecision({
          action: "hold",
          reasoning: `Swap execution failed: ${error instanceof Error ? error.message : String(error)}. Original: ${action.from}→${action.to} $${action.amount}`,
        });
        return NextResponse.json({ action: "hold", error: String(error) });
      }
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

    // 5. Log decision
    await logDecision({
      action: action.action,
      pair,
      amount_usd: amountUsd,
      entry_price: entryPrice,
      quote_price_impact: priceImpact,
      reasoning: action.reason,
      tx_hash: txHash,
    });

    // 6. Take portfolio snapshot
    const updatedPortfolio = await getPortfolioState(walletAddress);
    const latestSnapshot = await getLatestSnapshot();
    const initialDeposit = 10; // TODO: make configurable
    const pnlUsd = updatedPortfolio.totalValueUsd - initialDeposit;
    const pnlPct = (pnlUsd / initialDeposit) * 100;
    const totalX402 = (latestSnapshot?.x402_spent_total ?? 0) + 0.001;

    await logSnapshot({
      total_value_usd: updatedPortfolio.totalValueUsd,
      usdc_balance: updatedPortfolio.usdc.usd,
      eth_balance: updatedPortfolio.eth.usd,
      strk_balance: updatedPortfolio.strk.usd,
      vesu_deposited: updatedPortfolio.vesuDeposited,
      x402_spent_total: totalX402,
      pnl_usd: pnlUsd,
      pnl_pct: pnlPct,
    });

    return NextResponse.json({
      action: action.action,
      reason: action.reason,
      txHash,
      portfolio: { totalValueUsd: updatedPortfolio.totalValueUsd, pnlUsd, pnlPct },
    });
  } catch (error) {
    console.error("Cron agent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
