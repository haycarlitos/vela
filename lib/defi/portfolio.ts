import { RpcProvider, Contract, uint256 } from "starknet";
import {
  USDC_ADDRESS,
  ETH_ADDRESS,
  STRK_ADDRESS,
  VESU_USDC_VTOKEN,
  STARKNET_RPC_URL,
  STARKNET_RPC_FALLBACK,
  TOKEN_DECIMALS,
} from "@/lib/config";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "felt" }],
    outputs: [{ name: "balance", type: "Uint256" }],
    stateMutability: "view",
  },
] as const;

function getProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: STARKNET_RPC_URL });
}

function getFallbackProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: STARKNET_RPC_FALLBACK });
}

async function callWithFallback<T>(fn: (provider: RpcProvider) => Promise<T>): Promise<T> {
  try {
    return await fn(getProvider());
  } catch {
    return await fn(getFallbackProvider());
  }
}

// Fetch raw balance of an ERC-20 token
async function getTokenBalanceRaw(tokenAddress: string, walletAddress: string): Promise<bigint> {
  return callWithFallback(async (provider) => {
    const contract = new Contract({
      abi: ERC20_ABI as unknown as import("starknet").Abi,
      address: tokenAddress,
      providerOrAccount: provider,
    });
    const result = await contract.balanceOf(walletAddress);
    // starknet.js v9: balanceOf returns Uint256 directly or nested
    const balance = result.balance ?? result;
    return uint256.uint256ToBN(balance);
  });
}

// Convert raw balance to human-readable amount
function rawToHuman(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

export interface TokenBalance {
  raw: bigint;
  human: number;
  usd: number;
}

export interface PortfolioState {
  usdc: TokenBalance;
  eth: TokenBalance;
  strk: TokenBalance;
  vesuDeposited: number; // USD value of Vesu deposits
  totalValueUsd: number;
  prices: TokenPrices;
}

export interface TokenPrices {
  ETH: number;
  STRK: number;
  USDC: number;
}

// Fetch token prices from AVNU Impulse API
export async function getTokenPrices(): Promise<TokenPrices> {
  const response = await fetch("https://impulse.avnu.fi/v2/tokens/prices", {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch prices: ${response.status}`);
  }

  const data = await response.json();

  // AVNU returns prices keyed by token address
  const ethPrice = data[ETH_ADDRESS]?.currentPrice ?? data[ETH_ADDRESS.toLowerCase()]?.currentPrice ?? 0;
  const strkPrice = data[STRK_ADDRESS]?.currentPrice ?? data[STRK_ADDRESS.toLowerCase()]?.currentPrice ?? 0;

  return {
    ETH: ethPrice,
    STRK: strkPrice,
    USDC: 1.0,
  };
}

// Fetch Vesu deposit balance (vToken balance = deposited amount)
async function getVesuDeposit(walletAddress: string): Promise<number> {
  try {
    const raw = await getTokenBalanceRaw(VESU_USDC_VTOKEN, walletAddress);
    return rawToHuman(raw, TOKEN_DECIMALS.USDC); // vToken is 1:1 with underlying
  } catch {
    return 0;
  }
}

// Full portfolio state
export async function getPortfolioState(walletAddress: string): Promise<PortfolioState> {
  const [usdcRaw, ethRaw, strkRaw, vesuDeposited, prices] = await Promise.all([
    getTokenBalanceRaw(USDC_ADDRESS, walletAddress),
    getTokenBalanceRaw(ETH_ADDRESS, walletAddress),
    getTokenBalanceRaw(STRK_ADDRESS, walletAddress),
    getVesuDeposit(walletAddress),
    getTokenPrices(),
  ]);

  const usdcHuman = rawToHuman(usdcRaw, TOKEN_DECIMALS.USDC);
  const ethHuman = rawToHuman(ethRaw, TOKEN_DECIMALS.ETH);
  const strkHuman = rawToHuman(strkRaw, TOKEN_DECIMALS.STRK);

  const usdc: TokenBalance = { raw: usdcRaw, human: usdcHuman, usd: usdcHuman };
  const eth: TokenBalance = { raw: ethRaw, human: ethHuman, usd: ethHuman * prices.ETH };
  const strk: TokenBalance = { raw: strkRaw, human: strkHuman, usd: strkHuman * prices.STRK };

  const totalValueUsd = usdc.usd + eth.usd + strk.usd + vesuDeposited;

  return { usdc, eth, strk, vesuDeposited, totalValueUsd, prices };
}

// Fetch Vesu USDC pool APY
export async function getVesuUsdcApy(): Promise<number> {
  try {
    // Vesu API for pool APY data
    const response = await fetch("https://api.vesu.xyz/pools");
    if (!response.ok) return 0;
    const pools = await response.json();
    // Find USDC pool
    const usdcPool = pools.find((p: { token_address: string }) =>
      p.token_address?.toLowerCase() === USDC_ADDRESS.toLowerCase()
    );
    return usdcPool?.supply_apy ?? 0;
  } catch {
    return 0;
  }
}

// Get 1h/24h price changes from AVNU
export async function getPriceChanges(): Promise<Record<string, { change1h: number; change24h: number }>> {
  try {
    const response = await fetch("https://impulse.avnu.fi/v2/tokens/prices", {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return {};
    const data = await response.json();

    const result: Record<string, { change1h: number; change24h: number }> = {};

    const tokens = [
      { symbol: "ETH", address: ETH_ADDRESS },
      { symbol: "STRK", address: STRK_ADDRESS },
    ];

    for (const { symbol, address } of tokens) {
      const info = data[address] ?? data[address.toLowerCase()];
      if (info) {
        result[symbol] = {
          change1h: info.priceChange1h ?? 0,
          change24h: info.priceChange24h ?? 0,
        };
      }
    }

    return result;
  } catch {
    return {};
  }
}
