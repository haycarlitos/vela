// The deterministic guard between the model and the wallet.
//
// The model advises; this file decides. Every action the agent takes comes out
// of `decide()`, which only returns something the user's strategy allows, in
// tokens Vela trades, within the user's per-trade cap and the wallet's actual
// balances. The on-chain spending policies (spendingPolicies below) enforce the
// same caps again inside the wallet contract, so a bug here still cannot move
// more than the user approved.

import { isThinkDecision } from "@chipi-stack/backend";
import {
  MIN_TRADE_USD,
  TOKEN_DECIMALS,
  TOKENS,
  VESU_USDC_POSITION,
  VESU_USDC_VAULT,
  type TokenSymbol,
} from "./config";
import { STRATEGIES, type Strategy } from "./strategies";

export { STRATEGIES, isStrategy, type Strategy } from "./strategies";

export interface Holding {
  balance: number;
  usd: number;
}

export interface Portfolio {
  USDC: Holding;
  ETH: Holding;
  STRK: Holding;
  /** USDC supplied to Vesu, in USD. */
  vesuUsd: number;
}

export interface Limits {
  strategy: Strategy;
  /** Largest single action, in USD. */
  maxTradeUsd: number;
}

export type Action =
  | { kind: "hold"; reason: string }
  | { kind: "swap"; from: TokenSymbol; to: TokenSymbol; amountUsd: number; reason: string }
  | { kind: "supply"; amountUsd: number; reason: string }
  | { kind: "withdraw"; amountUsd: number; reason: string };

const TRADABLE = new Set<TokenSymbol>(["USDC", "ETH", "STRK"]);

function symbol(value: string | undefined): TokenSymbol | undefined {
  const s = value?.trim().toUpperCase();
  return s && TRADABLE.has(s as TokenSymbol) ? (s as TokenSymbol) : undefined;
}

function isVesuUsdc(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === VESU_USDC_POSITION;
}

const hold = (reason: string): Action => ({ kind: "hold", reason });

/** Round down to cents so a cap is never exceeded by rounding. */
function floorCents(usd: number): number {
  return Math.floor(usd * 100) / 100;
}

/**
 * Turn the model's decision into an action Vela is allowed to take, or a hold.
 * `decision` is whatever `/v1/ai/think` returned; nothing about it is trusted.
 */
export function decide(decision: unknown, portfolio: Portfolio, limits: Limits): Action {
  if (!isThinkDecision(decision)) return hold("The model's answer was not a valid decision");
  if (decision.action === "hold") return hold(decision.reason);

  const allowed = STRATEGIES[limits.strategy].actions;
  if (!allowed.includes(decision.action)) {
    return hold(`${decision.action} is not part of the ${limits.strategy} strategy`);
  }

  const requested = decision.amount;
  if (requested === undefined || !(requested > 0)) return hold("The decision had no amount");
  const cap = Math.min(requested, limits.maxTradeUsd);

  if (decision.action === "supply") {
    if (!isVesuUsdc(decision.to)) return hold(`Supplying to ${decision.to ?? "?"} is not supported`);
    const amountUsd = floorCents(Math.min(cap, portfolio.USDC.usd));
    if (amountUsd < MIN_TRADE_USD) return hold("Not enough liquid USDC to supply");
    return { kind: "supply", amountUsd, reason: decision.reason };
  }

  if (decision.action === "withdraw") {
    if (!isVesuUsdc(decision.from) && !isVesuUsdc(decision.to)) {
      return hold(`Withdrawing from ${decision.from ?? decision.to ?? "?"} is not supported`);
    }
    const amountUsd = floorCents(Math.min(cap, portfolio.vesuUsd));
    if (amountUsd < MIN_TRADE_USD) return hold("Nothing to withdraw from Vesu");
    return { kind: "withdraw", amountUsd, reason: decision.reason };
  }

  // swap
  const from = symbol(decision.from);
  const to = symbol(decision.to);
  if (!from || !to) return hold(`Vela does not trade ${decision.from ?? "?"} -> ${decision.to ?? "?"}`);
  if (from === to) return hold("Swap with the same token on both sides");
  const amountUsd = floorCents(Math.min(cap, portfolio[from].usd));
  if (amountUsd < MIN_TRADE_USD) return hold(`Not enough ${from} to swap`);
  return { kind: "swap", from, to, amountUsd, reason: decision.reason };
}

/** A USD amount of `token` in base units, at `priceUsd`, rounded down. */
export function usdToBaseUnits(amountUsd: number, token: TokenSymbol, priceUsd: number): bigint {
  if (!(priceUsd > 0)) throw new Error(`No price for ${token}`);
  const decimals = TOKEN_DECIMALS[token];
  const units = amountUsd / priceUsd;
  // toFixed keeps it exact in decimal; never round up past the balance.
  const [int, frac = ""] = units.toFixed(decimals).split(".");
  return BigInt(int + frac.padEnd(decimals, "0").slice(0, decimals));
}

const DAY = 86_400;

/** Every token the agent wallet can hold, Vesu's vault shares included. Each one gets a cap. */
export const CAPPED_TOKENS = [...Object.values(TOKENS), VESU_USDC_VAULT];

/**
 * On-chain caps for the session, one per token the wallet can hold.
 *
 * Per call: the user's max trade. Per day: four trades' worth. Prices are
 * read at hire time; ETH and STRK get 1.5x headroom so a normal price move
 * does not make a legal trade revert, and USDC 1.05x so a USDC price a hair
 * under $1 does not either. maxPerWindow is always positive (0 would mean no
 * cap).
 *
 * The Vesu vault's shares are a token too: withdrawing through the router
 * approves them to it (lib/vesu.ts). Their cap is the USDC cap in share units
 * (18 decimals): a share is worth at least one USDC (1.018 when this was
 * written; it grows as interest accrues), so a max-size withdrawal fits.
 */
export function spendingPolicies(
  maxTradeUsd: number,
  prices: Record<TokenSymbol, number>
): Array<{ token: string; maxPerCall: bigint; maxPerWindow: bigint; windowSeconds: number }> {
  if (!(maxTradeUsd >= MIN_TRADE_USD)) throw new Error(`maxTradeUsd must be at least ${MIN_TRADE_USD}`);
  const tokens = (Object.keys(TOKENS) as TokenSymbol[]).map((token) => {
    const headroom = token === "USDC" ? 1.05 : 1.5;
    const perCall = usdToBaseUnits(maxTradeUsd * headroom, token, token === "USDC" ? 1 : prices[token]);
    return { token: TOKENS[token], maxPerCall: perCall, maxPerWindow: perCall * 4n, windowSeconds: DAY };
  });
  const usdc = tokens.find((p) => p.token === TOKENS.USDC)!;
  const SHARES_PER_USDC_UNIT = 10n ** 12n; // 18 - 6 decimals
  return [
    ...tokens,
    { token: VESU_USDC_VAULT, maxPerCall: usdc.maxPerCall * SHARES_PER_USDC_UNIT, maxPerWindow: usdc.maxPerWindow * SHARES_PER_USDC_UNIT, windowSeconds: DAY },
  ];
}
