// Addresses and limits. Starknet mainnet only.

export const TOKENS = {
  // Native USDC, not bridged USDC.e.
  USDC: "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
  ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
} as const;

export type TokenSymbol = keyof typeof TOKENS;

export const TOKEN_DECIMALS: Record<TokenSymbol, number> = { USDC: 6, ETH: 18, STRK: 18 };

/**
 * Vesu Re7 USDC Core: an ERC-4626 vault whose asset() is native USDC
 * (verified on mainnet by walletv2, lib/chipi/vesu.ts). The SDK's bundled
 * VESU_USDC_MAINNET wraps bridged USDC.e, so it is deliberately not used.
 */
export const VESU_USDC_VAULT = "0x017891114c00b07317b9102adefbad9fd5de40c5616f094ee09fe2fad67191b1";

/** Name Vela and the AI API use for the Vesu USDC position. */
export const VESU_USDC_POSITION = "vesu_usdc";

/** How long a hired agent's session lasts. */
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

/** Session-signed transactions allowed over the session: one per trade, with room. */
export const SESSION_MAX_CALLS = 1_000;

/**
 * Functions the session key may call. The whitelist is not scoped to a
 * contract, so every token the wallet holds needs a spending policy
 * (see spendingPolicies in lib/policy.ts).
 * - approve: swaps and Vesu deposits
 * - multi_route_swap: AVNU (the calls /v1/ai/execute returns)
 * - deposit / withdraw: the Vesu ERC-4626 vault
 */
export const SESSION_ENTRYPOINTS = ["approve", "multi_route_swap", "deposit", "withdraw"];

/** Never trade less than this: fees and slippage eat it. */
export const MIN_TRADE_USD = 0.5;

/** Onboarding asks for at least this much before hiring: room for a couple of minimum trades. */
export const MIN_FUNDING_USD = 1;

/**
 * The most a wallet may hold while the agent runs (USD). A safety limit while
 * the SHHH wallet audit is pending; set MAX_DEPOSIT_USD to change it.
 */
export const MAX_DEPOSIT_USD = positiveEnv("MAX_DEPOSIT_USD", 100);

/**
 * How often each agent decides (minutes). Vercel Hobby runs `vercel.json`'s
 * cron once a day; with any external scheduler you can go down to minutes.
 * /api/tick is public, so this, not the scheduler, is the real limit.
 */
export const TICK_INTERVAL_MINUTES = positiveEnv("TICK_INTERVAL_MINUTES", 24 * 60);

/** A typo must not silently turn a limit off (NaN compares false with everything). */
function positiveEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!(value > 0)) throw new Error(`${name} must be a positive number, got "${raw}"`);
  return value;
}
