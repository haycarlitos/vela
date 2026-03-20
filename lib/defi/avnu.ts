import { CallData } from "starknet";
import { AVNU_API_URL, TOKEN_ADDRESSES, TOKEN_DECIMALS } from "@/lib/config";

export interface AvnuQuote {
  quoteId: string;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmount: string;
  buyAmount: string;
  sellAmountInUsd: number;
  buyAmountInUsd: number;
  routes: unknown[];
}

export interface SwapQuoteResult {
  quote: AvnuQuote;
  priceImpactPct: number;
  sellUsd: number;
  buyUsd: number;
  minReceivedUsd: number;
}

// Fetch swap quote from AVNU
export async function getSwapQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: bigint,
  takerAddress: string,
): Promise<SwapQuoteResult> {
  const params = new URLSearchParams({
    sellTokenAddress: sellToken,
    buyTokenAddress: buyToken,
    sellAmount: sellAmount.toString(),
    takerAddress,
    size: "1",
    integratorName: "vela",
  });

  const response = await fetch(`${AVNU_API_URL}/swap/v2/quotes?${params}`);
  if (!response.ok) {
    throw new Error(`AVNU quote failed: ${response.status} ${await response.text()}`);
  }

  const quotes: AvnuQuote[] = await response.json();
  if (quotes.length === 0) {
    throw new Error("No AVNU quotes available");
  }

  const quote = quotes[0];
  const sellUsd = quote.sellAmountInUsd;
  const buyUsd = quote.buyAmountInUsd;
  const priceImpactPct = sellUsd > 0 ? ((sellUsd - buyUsd) / sellUsd) * 100 : 0;
  const slippage = 0.5; // 0.5% slippage buffer
  const minReceivedUsd = buyUsd * (1 - slippage / 100);

  return { quote, priceImpactPct, sellUsd, buyUsd, minReceivedUsd };
}

// Build swap transaction calls (approve + swap)
export async function buildSwapCalls(
  quoteId: string,
  takerAddress: string,
  slippage = 0.005, // 0.5%
): Promise<{ contractAddress: string; entrypoint: string; calldata: string[] }[]> {
  const response = await fetch(`${AVNU_API_URL}/swap/v2/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId,
      takerAddress,
      slippage,
      includeApprove: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`AVNU build failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  // AVNU returns a list of calls [{contractAddress, entrypoint, calldata}]
  return data.calls ?? data;
}

// Helper: convert human amount to raw (e.g., 2.5 USDC → 2500000)
export function humanToRaw(amount: number, symbol: string): bigint {
  const decimals = TOKEN_DECIMALS[symbol] ?? 18;
  return BigInt(Math.floor(amount * 10 ** decimals));
}

// Full swap flow: quote → validate → build calls
export async function prepareSwap(
  fromSymbol: string,
  toSymbol: string,
  amountHuman: number,
  walletAddress: string,
): Promise<{
  calls: { contractAddress: string; entrypoint: string; calldata: string[] }[];
  quoteResult: SwapQuoteResult;
}> {
  const sellToken = TOKEN_ADDRESSES[fromSymbol];
  const buyToken = TOKEN_ADDRESSES[toSymbol];
  if (!sellToken || !buyToken) {
    throw new Error(`Unknown token symbol: ${fromSymbol} or ${toSymbol}`);
  }

  const sellAmount = humanToRaw(amountHuman, fromSymbol);
  const quoteResult = await getSwapQuote(sellToken, buyToken, sellAmount, walletAddress);

  // Validate price impact
  if (quoteResult.priceImpactPct > 2) {
    throw new Error(
      `Price impact too high: ${quoteResult.priceImpactPct.toFixed(2)}%. Max allowed: 2%`,
    );
  }

  const calls = await buildSwapCalls(quoteResult.quote.quoteId, walletAddress);
  return { calls, quoteResult };
}
