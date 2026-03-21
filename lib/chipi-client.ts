/**
 * Chipi AI API client — raw fetch, no SDK dependency.
 *
 * Endpoints align with the Chipi AI API design brief (intent-based).
 * Hardcoded to x402.chipipay.com for now. When the real API is live,
 * just change CHIPI_AI_API_URL env var.
 *
 * Until the API is live, each function falls back to the local
 * implementation (direct AVNU/Vesu/Claude calls).
 */

import type { PortfolioState } from "@/lib/defi/portfolio";
import type { AgentAction } from "@/lib/agent-brain";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CHIPI_API = process.env.CHIPI_AI_API_URL || "https://x402.chipipay.com";
const CHIPI_KEY = process.env.CHIPI_API_KEY || "";
const USE_CHIPI_API = !!process.env.CHIPI_AI_API_URL && !!process.env.CHIPI_API_KEY;

// ---------------------------------------------------------------------------
// Response types (match design brief shapes)
// ---------------------------------------------------------------------------

export interface ChipiPriceData {
  price: number;
  change1h: number;
  change24h: number;
}

export interface ChipiPricesResponse {
  tokens: Record<string, ChipiPriceData>;
  source?: string;
  updatedAt?: string;
}

export interface ChipiSignalData {
  price: number;
  change1h: number;
  change24h: number;
  rsi14: number;
  macd?: { value: number; signal: number; histogram: number };
  bollingerBands?: { upper: number; middle: number; lower: number };
  ema?: { ema20: number; ema50: number; ema200: number };
  volume24h?: number;
  volumeRatio?: number;
  trend: "oversold" | "overbought" | "bullish" | "bearish" | "neutral";
  signalStrength: number;
}

export interface ChipiSignalsResponse {
  tokens: Record<string, ChipiSignalData>;
  global?: {
    fearGreedIndex: number;
    fearGreedLabel: string;
    btcDominance: number;
  };
  yields?: Record<string, number>;
  updatedAt?: string;
}

export interface ChipiIntentDecision {
  action: string;
  from?: string;
  to?: string;
  amount?: number;
  token?: string;
  reason: string;
}

export interface ChipiIntentResponse {
  intentId: string;
  status: "CREATED" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED" | "EXECUTED";
  result?: {
    decision: ChipiIntentDecision;
    signals?: Record<string, ChipiSignalData>;
    meta?: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      cost: number;
    };
  };
  fees?: {
    charged: number;
    remainingBalance: number;
  };
  estimatedMs?: number;
}

export interface ChipiExecuteResponse {
  calls: Array<{
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }>;
  quote: {
    sellAmount: string;
    buyAmount: string;
    priceImpactPct: number;
    route: string;
  };
  fees?: {
    charged: number;
    remainingBalance: number;
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function chipiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CHIPI_API}${path}`, {
    headers: { "X-Chipi-Key": CHIPI_KEY },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ChipiApiError(path, res.status, body);
  }
  return res.json() as Promise<T>;
}

async function chipiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CHIPI_API}${path}`, {
    method: "POST",
    headers: {
      "X-Chipi-Key": CHIPI_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ChipiApiError(path, res.status, text);
  }
  return res.json() as Promise<T>;
}

export class ChipiApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Chipi API ${endpoint}: ${status} — ${body}`);
    this.name = "ChipiApiError";
  }

  get isInsufficientBalance(): boolean {
    return this.body.includes("INSUFFICIENT_BALANCE");
  }

  get isSessionExpired(): boolean {
    return this.body.includes("SESSION_EXPIRED");
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

// ---------------------------------------------------------------------------
// Local fallbacks (used when Chipi API is not yet live)
// ---------------------------------------------------------------------------

async function localGetPrices(): Promise<ChipiPricesResponse> {
  const { getTokenPrices, getPriceChanges } = await import("@/lib/defi/portfolio");
  const [prices, changes] = await Promise.all([getTokenPrices(), getPriceChanges()]);

  return {
    tokens: {
      ETH: {
        price: prices.ETH,
        change1h: changes.ETH?.change1h ?? 0,
        change24h: changes.ETH?.change24h ?? 0,
      },
      STRK: {
        price: prices.STRK,
        change1h: changes.STRK?.change1h ?? 0,
        change24h: changes.STRK?.change24h ?? 0,
      },
      USDC: { price: 1.0, change1h: 0, change24h: 0 },
    },
    source: "avnu-local",
    updatedAt: new Date().toISOString(),
  };
}

async function localGetSignals(tokens: string[]): Promise<ChipiSignalsResponse> {
  // Without a price-engine / Redis, we can only provide basic price signals.
  // Technical indicators (RSI, MACD, Bollinger) require historical data that
  // the local implementation doesn't have yet.
  const prices = await localGetPrices();

  const tokenSignals: Record<string, ChipiSignalData> = {};
  for (const token of tokens) {
    const p = prices.tokens[token];
    if (!p) continue;
    tokenSignals[token] = {
      price: p.price,
      change1h: p.change1h,
      change24h: p.change24h,
      rsi14: 50, // neutral default — no historical data locally
      trend: "neutral",
      signalStrength: Math.min(Math.abs(p.change1h) / 3, 1), // rough proxy
    };
  }

  let yields: Record<string, number> | undefined;
  try {
    const { getVesuUsdcApy } = await import("@/lib/defi/portfolio");
    const vesuApy = await getVesuUsdcApy();
    yields = { vesu_usdc: vesuApy };
  } catch {
    // non-critical
  }

  return {
    tokens: tokenSignals,
    yields,
    updatedAt: new Date().toISOString(),
  };
}

async function localCreateThinkIntent(
  portfolio: PortfolioState,
  riskProfile: string,
): Promise<ChipiIntentResponse> {
  const { getAgentDecision } = await import("@/lib/agent-brain");
  const { getRecentDecisions } = await import("@/lib/db");
  const { getVesuUsdcApy, getPriceChanges } = await import("@/lib/defi/portfolio");

  const [decisions, vesuApy, priceChanges] = await Promise.all([
    getRecentDecisions(20),
    getVesuUsdcApy(),
    getPriceChanges(),
  ]);

  const decision = await getAgentDecision(portfolio, decisions, vesuApy, priceChanges);

  return {
    intentId: `local_${Date.now()}`,
    status: "COMPLETED",
    result: {
      decision: decision as ChipiIntentDecision,
      meta: {
        model: "claude-haiku-4-5",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        cost: 0.003,
      },
    },
    fees: { charged: 0.003, remainingBalance: -1 }, // -1 = local, no billing
  };
}

async function localExecuteIntent(
  decision: ChipiIntentDecision,
  walletAddress: string,
): Promise<ChipiExecuteResponse> {
  if (decision.action === "swap" && decision.from && decision.to && decision.amount) {
    const { prepareSwap } = await import("@/lib/defi/avnu");
    const { calls, quoteResult } = await prepareSwap(
      decision.from,
      decision.to,
      decision.amount,
      walletAddress,
    );
    return {
      calls,
      quote: {
        sellAmount: quoteResult.quote.sellAmount,
        buyAmount: quoteResult.quote.buyAmount,
        priceImpactPct: quoteResult.priceImpactPct,
        route: `${decision.from} → ${decision.to}`,
      },
    };
  }

  if (decision.action === "supply_vesu" && decision.amount) {
    const { prepareVesuSupply } = await import("@/lib/defi/vesu");
    const { calls } = await prepareVesuSupply(decision.amount, walletAddress);
    return {
      calls,
      quote: {
        sellAmount: String(decision.amount * 1e6),
        buyAmount: String(decision.amount * 1e6),
        priceImpactPct: 0,
        route: "USDC → Vesu vUSDC",
      },
    };
  }

  if (decision.action === "withdraw_vesu" && decision.amount) {
    const { prepareVesuWithdraw } = await import("@/lib/defi/vesu");
    const { calls } = await prepareVesuWithdraw(decision.amount, walletAddress);
    return {
      calls,
      quote: {
        sellAmount: String(decision.amount * 1e6),
        buyAmount: String(decision.amount * 1e6),
        priceImpactPct: 0,
        route: "Vesu vUSDC → USDC",
      },
    };
  }

  // hold — no calls
  return {
    calls: [],
    quote: { sellAmount: "0", buyAmount: "0", priceImpactPct: 0, route: "hold" },
  };
}

// ---------------------------------------------------------------------------
// Public API — falls back to local implementations when CHIPI_AI_API_URL unset
// ---------------------------------------------------------------------------

/** Get token prices — FREE (no billing). */
export async function getPrices(): Promise<ChipiPricesResponse> {
  if (!USE_CHIPI_API) return localGetPrices();
  return chipiGet<ChipiPricesResponse>("/api/ai/prices?chain=starknet&tokens=ETH,STRK,USDC");
}

/** Get market signals — $0.0005 per call. */
export async function getSignals(tokens: string[] = ["ETH", "STRK"]): Promise<ChipiSignalsResponse> {
  if (!USE_CHIPI_API) return localGetSignals(tokens);
  return chipiGet<ChipiSignalsResponse>(
    `/api/ai/signals?chain=starknet&tokens=${tokens.join(",")}`,
  );
}

/**
 * Create an AI think intent — $0.003 (sync mode, blocks until complete).
 * Returns the full intent with decision result.
 */
export async function createThinkIntent(
  portfolio: PortfolioState,
  riskProfile: string = "balanced",
): Promise<ChipiIntentResponse> {
  if (!USE_CHIPI_API) return localCreateThinkIntent(portfolio, riskProfile);

  return chipiPost<ChipiIntentResponse>("/api/ai/intents?sync=true", {
    type: "think",
    chain: "starknet",
    payload: {
      portfolio: {
        tokens: {
          USDC: { balance: portfolio.usdc.human, usd: portfolio.usdc.usd },
          ETH: { balance: portfolio.eth.human, usd: portfolio.eth.usd },
          STRK: { balance: portfolio.strk.human, usd: portfolio.strk.usd },
        },
        deposits: {
          vesu_usdc: { balance: portfolio.vesuDeposited },
        },
        totalValueUsd: portfolio.totalValueUsd,
      },
      riskProfile,
      model: "haiku",
    },
  });
}

/**
 * Poll an async intent status — FREE.
 * Only needed if you create intents without ?sync=true.
 */
export async function getIntentStatus(intentId: string): Promise<ChipiIntentResponse> {
  return chipiGet<ChipiIntentResponse>(`/api/ai/intents/${intentId}`);
}

/**
 * Build on-chain tx calls from a completed intent — $0.002.
 * Returns calldata ready for session key execution.
 */
export async function executeIntent(
  intentId: string,
  walletAddress: string,
  decision?: ChipiIntentDecision,
): Promise<ChipiExecuteResponse> {
  // Local fallback needs the decision to know what to build
  if (!USE_CHIPI_API) {
    if (!decision) throw new Error("Local mode requires decision for executeIntent");
    return localExecuteIntent(decision, walletAddress);
  }

  return chipiPost<ChipiExecuteResponse>(`/api/ai/intents/${intentId}/execute`, {
    walletAddress,
    slippage: 0.005,
  });
}

/**
 * Check if any signal is strong enough to warrant an AI call.
 * Saves $0.003 per cycle when market is quiet.
 */
export function hasActionableSignal(
  signals: ChipiSignalsResponse,
  threshold: number = 0.6,
): boolean {
  for (const data of Object.values(signals.tokens)) {
    if (data.signalStrength > threshold) return true;
  }
  return false;
}

/**
 * Convert a Chipi intent decision to the local AgentAction type.
 */
export function intentToAgentAction(decision: ChipiIntentDecision): AgentAction {
  switch (decision.action) {
    case "swap":
      return {
        action: "swap",
        from: decision.from ?? "USDC",
        to: decision.to ?? "ETH",
        amount: decision.amount ?? 0,
        reason: decision.reason,
      };
    case "supply_vesu":
      return {
        action: "supply_vesu",
        token: decision.token ?? "USDC",
        amount: decision.amount ?? 0,
        reason: decision.reason,
      };
    case "withdraw_vesu":
      return {
        action: "withdraw_vesu",
        amount: decision.amount ?? 0,
        reason: decision.reason,
      };
    default:
      return { action: "hold", reason: decision.reason };
  }
}
