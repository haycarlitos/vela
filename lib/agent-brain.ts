import Anthropic from "@anthropic-ai/sdk";
import type { PortfolioState } from "@/lib/defi/portfolio";
import type { Decision } from "@/lib/db";
import {
  X402_RESERVE_USD,
  MIN_SWAP_USD,
  MAX_PORTFOLIO_RISK_PCT,
  MIN_VESU_APY_SUPPLY,
  MIN_VESU_APY_KEEP,
} from "@/lib/config";

// Structured action types the agent can take
export type AgentAction =
  | { action: "swap"; from: string; to: string; amount: number; reason: string }
  | { action: "supply_vesu"; token: string; amount: number; reason: string }
  | { action: "withdraw_vesu"; amount: number; reason: string }
  | { action: "hold"; reason: string };

const SYSTEM_PROMPT = `You are Vela, an autonomous DeFi agent managing a portfolio on Starknet mainnet.
You make decisions every 30 minutes about swaps (AVNU), yield (Vesu), and rebalancing.

## Rules — ALWAYS follow these:

1. **Cost awareness**: Before any swap, consider price impact + 0.5% slippage. Only execute if expected gain > total cost.
2. **Minimum swap**: Never swap less than $${MIN_SWAP_USD} — costs eat the profit.
3. **x402 reserve**: Keep at least $${X402_RESERVE_USD} USDC untouched for thinking payments.
4. **Position sizing**: Never risk more than ${MAX_PORTFOLIO_RISK_PCT}% of total portfolio on a single trade.
5. **Vesu supply**: Only supply if APY > ${MIN_VESU_APY_SUPPLY}%.
6. **Vesu withdraw**: Withdraw if APY drops below ${MIN_VESU_APY_KEEP}% OR need liquidity for a profitable swap.
7. **Self-evaluation**: Review your track record. If a token keeps losing, reduce exposure. If a strategy works, continue.
8. **Log everything**: Always explain your reasoning including cost breakdown.

## Available actions (respond with exactly ONE JSON object):

{ "action": "swap", "from": "USDC", "to": "ETH", "amount": 2.0, "reason": "..." }
{ "action": "supply_vesu", "token": "USDC", "amount": 3.0, "reason": "..." }
{ "action": "withdraw_vesu", "amount": 2.0, "reason": "..." }
{ "action": "hold", "reason": "..." }

## Important:
- Respond with ONLY a valid JSON object, nothing else.
- The "amount" is in USD for swaps and USDC for Vesu operations.
- Always include a detailed "reason" explaining your logic and cost analysis.`;

function formatDecisionHistory(decisions: Decision[]): string {
  if (decisions.length === 0) return "No previous decisions — this is your first cycle.";

  const rows = decisions.map((d) => {
    const time = new Date(d.created_at).toISOString().slice(11, 16);
    const outcome = d.outcome === "profit" ? "+profit" : d.outcome === "loss" ? "-loss" : "open";
    return `| ${time} | ${d.action} | ${d.pair ?? "—"} | $${d.amount_usd?.toFixed(2) ?? "—"} | ${d.reasoning?.slice(0, 60) ?? "—"} | ${outcome} |`;
  });

  return `| Time | Action | Pair | Amount | Reasoning | Outcome |\n|------|--------|------|--------|-----------|---------|\n${rows.join("\n")}`;
}

function formatTrackRecord(decisions: Decision[]): string {
  const trades = decisions.filter((d) => d.outcome !== "open" && d.action === "swap");
  const wins = trades.filter((d) => d.outcome === "profit").length;
  const losses = trades.filter((d) => d.outcome === "loss").length;
  const totalDecisions = decisions.length;
  const totalX402 = decisions.reduce((sum, d) => sum + Number(d.x402_cost), 0);

  if (trades.length === 0) {
    return `No completed trades yet. ${totalDecisions} total decisions. x402 spent: $${totalX402.toFixed(3)}`;
  }

  const winRate = ((wins / trades.length) * 100).toFixed(0);
  return `Win rate: ${wins}/${trades.length} (${winRate}%). Losses: ${losses}. Total decisions: ${totalDecisions}. x402 spent: $${totalX402.toFixed(3)}`;
}

export function buildPrompt(
  portfolio: PortfolioState,
  decisions: Decision[],
  vesuApy: number,
  priceChanges: Record<string, { change1h: number; change24h: number }>,
): string {
  const ethChange = priceChanges.ETH ?? { change1h: 0, change24h: 0 };
  const strkChange = priceChanges.STRK ?? { change1h: 0, change24h: 0 };

  return `## Current Portfolio
- USDC: $${portfolio.usdc.usd.toFixed(2)} (liquid)
- ETH: $${portfolio.eth.usd.toFixed(2)} (${portfolio.eth.human.toFixed(6)} ETH @ $${portfolio.prices.ETH.toFixed(2)})
- STRK: $${portfolio.strk.usd.toFixed(2)} (${portfolio.strk.human.toFixed(4)} STRK @ $${portfolio.prices.STRK.toFixed(4)})
- Vesu USDC deposited: $${portfolio.vesuDeposited.toFixed(2)}
- Total value: $${portfolio.totalValueUsd.toFixed(2)}

## Market Data
- ETH price: $${portfolio.prices.ETH.toFixed(2)} (1h: ${ethChange.change1h > 0 ? "+" : ""}${ethChange.change1h.toFixed(2)}%, 24h: ${ethChange.change24h > 0 ? "+" : ""}${ethChange.change24h.toFixed(2)}%)
- STRK price: $${portfolio.prices.STRK.toFixed(4)} (1h: ${strkChange.change1h > 0 ? "+" : ""}${strkChange.change1h.toFixed(2)}%, 24h: ${strkChange.change24h > 0 ? "+" : ""}${strkChange.change24h.toFixed(2)}%)
- Vesu USDC APY: ${vesuApy.toFixed(2)}%

## Your Recent Decisions (last 20)
${formatDecisionHistory(decisions)}

## Your Track Record
${formatTrackRecord(decisions)}

## What should we do? Respond with a single JSON action.`;
}

export async function getAgentDecision(
  portfolio: PortfolioState,
  decisions: Decision[],
  vesuApy: number,
  priceChanges: Record<string, { change1h: number; change24h: number }>,
): Promise<AgentAction> {
  const anthropic = new Anthropic();

  const userPrompt = buildPrompt(portfolio, decisions, vesuApy, priceChanges);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Parse JSON from response — handle markdown code blocks
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { action: "hold", reason: `Failed to parse agent response: ${text.slice(0, 100)}` };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as AgentAction;
    // Validate action type
    if (!["swap", "supply_vesu", "withdraw_vesu", "hold"].includes(parsed.action)) {
      return { action: "hold", reason: `Unknown action type: ${parsed.action}` };
    }
    return parsed;
  } catch {
    return { action: "hold", reason: `Invalid JSON from agent: ${text.slice(0, 100)}` };
  }
}

// Evaluate open positions and mark profit/loss
export async function evaluateOpenPositions(
  openDecisions: Decision[],
  currentPrices: Record<string, number>,
  markOutcomeFn: (id: number, outcome: "profit" | "loss") => Promise<void>,
) {
  for (const d of openDecisions) {
    if (!d.pair || !d.entry_price) continue;

    const toToken = d.pair.split("\u2192")[1]; // "USDC→ETH" → "ETH"
    if (!toToken) continue;

    const currentPrice = currentPrices[toToken];
    if (!currentPrice || !d.entry_price) continue;

    const ageMs = Date.now() - new Date(d.created_at).getTime();
    // Mark after 24h
    if (ageMs > 24 * 60 * 60 * 1000) {
      const pnl = (currentPrice - Number(d.entry_price)) / Number(d.entry_price);
      await markOutcomeFn(d.id, pnl > 0 ? "profit" : "loss");
    }
  }
}
