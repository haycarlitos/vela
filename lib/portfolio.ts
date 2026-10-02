import "server-only";
import { RpcProvider } from "starknet";
import { Chain, ChainToken } from "@chipi-stack/backend";
import { chipi } from "./chipi";
import type { Portfolio } from "./policy";
import type { TokenSymbol } from "./config";
import { vesuMaxWithdraw } from "./vesu";

// Public keyless RPC by default; set STARKNET_RPC_URL to your own node.
const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL || "https://api.cartridge.gg/x/starknet/mainnet",
});

/** Read-only contract call on that RPC. */
export function callContract(call: { contractAddress: string; entrypoint: string; calldata: string[] }): Promise<string[]> {
  return provider.callContract(call);
}

const SYMBOLS: TokenSymbol[] = ["USDC", "ETH", "STRK"];

export async function getPrices(): Promise<Record<TokenSymbol, number>> {
  const { tokens } = await chipi().ai.prices({ tokens: SYMBOLS });
  const price = (s: TokenSymbol) => {
    const entry = Object.entries(tokens).find(([k]) => k.toUpperCase() === s)?.[1];
    if (!entry || !(entry.price > 0)) throw new Error(`No price for ${s}`);
    return entry.price;
  };
  return { USDC: price("USDC"), ETH: price("ETH"), STRK: price("STRK") };
}

export async function getPortfolio(walletAddress: string): Promise<{ portfolio: Portfolio; prices: Record<TokenSymbol, number> }> {
  const sdk = chipi();
  const [prices, balances, vesuBase] = await Promise.all([
    getPrices(),
    Promise.all(
      SYMBOLS.map((s) =>
        sdk.getTokenBalance({ walletPublicKey: walletAddress, chainToken: ChainToken[s], chain: Chain.STARKNET })
      )
    ),
    vesuMaxWithdraw(callContract, walletAddress),
  ]);

  const holding = (s: TokenSymbol) => {
    const balance = Number(balances[SYMBOLS.indexOf(s)].balance);
    return { balance, usd: balance * prices[s] };
  };

  return {
    portfolio: {
      USDC: holding("USDC"),
      ETH: holding("ETH"),
      STRK: holding("STRK"),
      vesuUsd: (Number(vesuBase) / 1e6) * prices.USDC,
    },
    prices,
  };
}

export function totalUsd(p: Portfolio): number {
  return p.USDC.usd + p.ETH.usd + p.STRK.usd + p.vesuUsd;
}
