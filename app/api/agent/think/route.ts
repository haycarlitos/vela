import { NextRequest, NextResponse } from "next/server";
import { withX402Payment } from "@/lib/x402-route";
import { getAgentDecision, evaluateOpenPositions } from "@/lib/agent-brain";
import { getPortfolioState, getVesuUsdcApy, getPriceChanges } from "@/lib/defi/portfolio";
import { getRecentDecisions, getOpenSwapDecisions, markOutcome } from "@/lib/db";
import { X402_THINK_COST, MERCHANT_WALLET } from "@/lib/config";

// POST /api/agent/think
// x402-protected: costs $0.001 per decision
// Fetches portfolio state, asks Claude for a decision, returns structured action
export const POST = withX402Payment(
  {
    amount: X402_THINK_COST,
    recipient: MERCHANT_WALLET,
    description: "Vela agent decision - AI-powered DeFi analysis",
  },
  async (req: NextRequest) => {
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    // Fetch all data in parallel
    const [portfolio, vesuApy, priceChanges, recentDecisions, openDecisions] = await Promise.all([
      getPortfolioState(walletAddress),
      getVesuUsdcApy(),
      getPriceChanges(),
      getRecentDecisions(20),
      getOpenSwapDecisions(),
    ]);

    // Evaluate open positions before asking Claude
    await evaluateOpenPositions(
      openDecisions,
      { ETH: portfolio.prices.ETH, STRK: portfolio.prices.STRK, USDC: 1 },
      markOutcome,
    );

    // Ask Claude for a decision
    const decision = await getAgentDecision(portfolio, recentDecisions, vesuApy, priceChanges);

    return NextResponse.json({
      decision,
      portfolio: {
        totalValueUsd: portfolio.totalValueUsd,
        usdc: portfolio.usdc.usd,
        eth: portfolio.eth.usd,
        strk: portfolio.strk.usd,
        vesu: portfolio.vesuDeposited,
      },
      prices: portfolio.prices,
      vesuApy,
    });
  },
);
