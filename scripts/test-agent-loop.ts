#!/usr/bin/env npx tsx
/**
 * Test script: Full agent decision → DeFi execution loop
 *
 * Usage: npx tsx scripts/test-agent-loop.ts <wallet_address>
 *
 * This runs one cycle of the agent loop without x402 or cron:
 * 1. Fetch portfolio state
 * 2. Ask Claude for a decision
 * 3. Log the decision (no execution — dry run)
 */

import { getPortfolioState, getVesuUsdcApy, getPriceChanges } from "../lib/defi/portfolio";
import { getAgentDecision } from "../lib/agent-brain";

async function main() {
  const walletAddress = process.argv[2];
  if (!walletAddress) {
    console.error("Usage: npx tsx scripts/test-agent-loop.ts <wallet_address>");
    process.exit(1);
  }

  console.log(`\n--- Vela Agent Test Loop ---`);
  console.log(`Wallet: ${walletAddress}\n`);

  // 1. Fetch portfolio
  console.log("Fetching portfolio state...");
  const portfolio = await getPortfolioState(walletAddress);
  console.log(`  USDC: $${portfolio.usdc.usd.toFixed(2)}`);
  console.log(`  ETH:  $${portfolio.eth.usd.toFixed(2)} (${portfolio.eth.human.toFixed(6)} @ $${portfolio.prices.ETH.toFixed(2)})`);
  console.log(`  STRK: $${portfolio.strk.usd.toFixed(2)} (${portfolio.strk.human.toFixed(4)} @ $${portfolio.prices.STRK.toFixed(4)})`);
  console.log(`  Vesu: $${portfolio.vesuDeposited.toFixed(2)}`);
  console.log(`  Total: $${portfolio.totalValueUsd.toFixed(2)}`);

  // 2. Fetch market data
  console.log("\nFetching market data...");
  const [vesuApy, priceChanges] = await Promise.all([getVesuUsdcApy(), getPriceChanges()]);
  console.log(`  Vesu USDC APY: ${vesuApy.toFixed(2)}%`);
  for (const [symbol, changes] of Object.entries(priceChanges)) {
    console.log(`  ${symbol}: 1h ${changes.change1h > 0 ? "+" : ""}${changes.change1h.toFixed(2)}%, 24h ${changes.change24h > 0 ? "+" : ""}${changes.change24h.toFixed(2)}%`);
  }

  // 3. Ask Claude (no x402 payment in test mode)
  console.log("\nAsking Claude for decision...");
  const decision = await getAgentDecision(portfolio, [], vesuApy, priceChanges);
  console.log(`\n  Action: ${decision.action}`);
  if (decision.action === "swap") {
    console.log(`  From: ${decision.from} → ${decision.to}`);
    console.log(`  Amount: $${decision.amount}`);
  } else if (decision.action === "supply_vesu") {
    console.log(`  Token: ${decision.token}`);
    console.log(`  Amount: $${decision.amount}`);
  } else if (decision.action === "withdraw_vesu") {
    console.log(`  Amount: $${decision.amount}`);
  }
  console.log(`  Reason: ${decision.reason}`);

  console.log("\n--- Dry run complete (no execution) ---\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
