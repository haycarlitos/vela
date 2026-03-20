import { NextRequest, NextResponse } from "next/server";
import { getPortfolioState, getVesuUsdcApy, getPriceChanges } from "@/lib/defi/portfolio";
import { getRecentDecisions, getSnapshots, getTradeStats, getLatestSnapshot } from "@/lib/db";

// GET /api/agent/status?wallet=0x...
// Returns current portfolio state, recent decisions, and performance stats
export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get("wallet");
  if (!walletAddress) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 });
  }

  try {
    const [portfolio, vesuApy, priceChanges, decisions, snapshots, stats, latestSnapshot] =
      await Promise.all([
        getPortfolioState(walletAddress),
        getVesuUsdcApy(),
        getPriceChanges(),
        getRecentDecisions(50),
        getSnapshots(200),
        getTradeStats(),
        getLatestSnapshot(),
      ]);

    return NextResponse.json({
      portfolio: {
        totalValueUsd: portfolio.totalValueUsd,
        usdc: { balance: portfolio.usdc.human, usd: portfolio.usdc.usd },
        eth: {
          balance: portfolio.eth.human,
          usd: portfolio.eth.usd,
          price: portfolio.prices.ETH,
        },
        strk: {
          balance: portfolio.strk.human,
          usd: portfolio.strk.usd,
          price: portfolio.prices.STRK,
        },
        vesuDeposited: portfolio.vesuDeposited,
        vesuApy,
      },
      priceChanges,
      decisions: decisions.map((d) => ({
        id: d.id,
        createdAt: d.created_at,
        action: d.action,
        pair: d.pair,
        amountUsd: d.amount_usd,
        reasoning: d.reasoning,
        txHash: d.tx_hash,
        outcome: d.outcome,
      })),
      snapshots: snapshots.map((s) => ({
        createdAt: s.created_at,
        totalValueUsd: s.total_value_usd,
        pnlUsd: s.pnl_usd,
        pnlPct: s.pnl_pct,
      })),
      stats: {
        winRate: stats.winRate,
        totalTrades: stats.totalTrades,
        winningTrades: stats.winningTrades,
        losingTrades: stats.losingTrades,
        totalDecisions: stats.totalDecisions,
        totalX402Spent: stats.totalX402Spent,
      },
      pnl: latestSnapshot
        ? { usd: latestSnapshot.pnl_usd, pct: latestSnapshot.pnl_pct }
        : { usd: 0, pct: 0 },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch status", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
