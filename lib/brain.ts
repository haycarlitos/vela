import "server-only";
import type { SessionKeyData, ThinkResponse, WalletData } from "@chipi-stack/backend";
import { chipi, sessionSecret } from "./chipi";
import { VESU_USDC_POSITION, X402_MAX_PRICE_USDC } from "./config";
import type { Portfolio } from "./policy";
import { STRATEGIES, type Strategy } from "./strategies";

/** The agent's wallet and session, to pay for the decision over x402. */
export interface AiPayment {
  wallet: WalletData;
  session: SessionKeyData;
}

/**
 * One decision from Chipi's AI API. /v1/ai/think injects live market signals
 * and yields; Vela adds the portfolio in USD and the strategy's risk score.
 * The answer is advice: lib/policy.ts decides what actually happens.
 *
 * With `payment`, a 402 from Chipi (no credits) is paid per call from the
 * agent's session over x402, at most X402_MAX_PRICE_USDC (module 12).
 */
export async function think(
  portfolio: Portfolio,
  strategy: Strategy,
  maxTradeUsd: number,
  payment?: AiPayment
): Promise<ThinkResponse> {
  const total = portfolio.USDC.usd + portfolio.ETH.usd + portfolio.STRK.usd + portfolio.vesuUsd;
  return chipi().ai.think(
    {
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
    },
    payment
      ? { payWithSession: { encryptKey: sessionSecret(), ...payment, maxAmount: X402_MAX_PRICE_USDC } }
      : {}
  );
}

/** What the decision cost, in USD: credits charged, or the x402 payment. */
export function aiCostUsd(res: Pick<ThinkResponse, "cost" | "x402Payment">): number {
  return res.x402Payment ? Number(res.x402Payment.amount) / 1e6 : res.cost.charged;
}

function round(usd: number): number {
  return Math.round(usd * 100) / 100;
}
