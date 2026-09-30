import "server-only";
import type { ThinkResponse } from "@chipi-stack/backend";
import { chipi } from "./chipi";
import { VESU_USDC_POSITION } from "./config";
import type { Portfolio } from "./policy";
import { STRATEGIES, type Strategy } from "./strategies";

/**
 * One decision from Chipi's AI API. /v1/ai/think injects live market signals
 * and yields; Vela adds the portfolio in USD and the strategy's risk score.
 * The answer is advice: lib/policy.ts decides what actually happens.
 */
export async function think(portfolio: Portfolio, strategy: Strategy, maxTradeUsd: number): Promise<ThinkResponse> {
  const total = portfolio.USDC.usd + portfolio.ETH.usd + portfolio.STRK.usd + portfolio.vesuUsd;
  return chipi().ai.think({
    portfolio: {
      amountUnit: "USD",
      USDC: round(portfolio.USDC.usd),
      ETH: round(portfolio.ETH.usd),
      STRK: round(portfolio.STRK.usd),
      [VESU_USDC_POSITION]: round(portfolio.vesuUsd),
      total: round(total),
      maxTradeUsd,
    },
    riskScore: STRATEGIES[strategy].riskScore,
    maxSingleTradePercent: total > 0 ? Math.min(100, Math.round((maxTradeUsd / total) * 100)) : undefined,
  });
}

function round(usd: number): number {
  return Math.round(usd * 100) / 100;
}
