// Token addresses — Starknet mainnet only
export const USDC_ADDRESS = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";
export const ETH_ADDRESS = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
export const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// Vesu
export const VESU_USDC_VTOKEN = process.env.VESU_USDC_VTOKEN || "0x017f19582c61479f2fe0b6606300e975c0a8f439102f43eeecc1d0e9b3d84350";

// AVNU
export const AVNU_API_URL = process.env.AVNU_API_URL || "https://starknet.api.avnu.fi";
export const AVNU_ROUTER = "0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f";

// x402
export const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://x402.chipipay.com";
export const MERCHANT_WALLET = process.env.MERCHANT_WALLET || "0x0189E2EBb955fc19bf37bD8Fc0400De24C123363E7955282bcfb99679a773E61";
export const X402_THINK_COST = "0.001"; // $0.001 per decision

// Agent defaults
export const AGENT_THINK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_DURATION_SECONDS = 604800; // 7 days
export const DEFAULT_MAX_PER_CALL_USD = 5; // $5
export const DEFAULT_MAX_PER_WINDOW_USD = 10; // $10 per day
export const WINDOW_SECONDS = 86400; // 24h rolling window
export const X402_RESERVE_USD = 2; // Keep $2 USDC for x402 payments
export const MIN_SWAP_USD = 0.50; // Never swap less than $0.50
export const MAX_PORTFOLIO_RISK_PCT = 30; // Max 30% on single trade
export const MIN_VESU_APY_SUPPLY = 3; // Only supply if APY > 3%
export const MIN_VESU_APY_KEEP = 2; // Withdraw if APY < 2%

// Starknet RPC
export const STARKNET_RPC_URL = "https://starknet-mainnet.infura.io/v3/4a4a1fdd7d704509aa99154fb29886e2";
export const STARKNET_RPC_FALLBACK = "https://rpc.starknet.lava.build";

// Token decimals
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  ETH: 18,
  STRK: 18,
};

// Token symbols mapped to addresses
export const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: USDC_ADDRESS,
  ETH: ETH_ADDRESS,
  STRK: STRK_ADDRESS,
};

export const ADDRESS_TO_SYMBOL: Record<string, string> = {
  [USDC_ADDRESS]: "USDC",
  [ETH_ADDRESS]: "ETH",
  [STRK_ADDRESS]: "STRK",
};
