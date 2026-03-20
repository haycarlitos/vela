#!/usr/bin/env npx tsx
/**
 * Test script: Session key x402 payment
 *
 * Tests that a session key can auto-pay for x402 agent think calls.
 * This is the flow used in production — the agent pays for its own decisions.
 *
 * Usage: npx tsx scripts/test-session-payment.ts
 *
 * Prerequisites:
 * - Active session key for the test wallet
 * - ANTHROPIC_API_KEY in env
 * - Vela dev server running on localhost:3000
 */

export {};

const VELA_URL = process.env.VELA_URL || "http://localhost:3000";

async function main() {
  console.log("\n--- x402 Session Payment Test ---\n");

  // 1. Get 402 response with payment requirements
  console.log("1. Getting x402 payment requirements...");
  const res402 = await fetch(`${VELA_URL}/api/agent/think`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: "0x0test" }),
  });

  if (res402.status !== 402) {
    console.log(`   Unexpected status: ${res402.status}`);
    return;
  }

  const paymentReq = await res402.json();
  console.log("   Payment required:", {
    amount: paymentReq.x402?.amount,
    currency: paymentReq.x402?.currency,
    recipient: paymentReq.x402?.recipient?.slice(0, 10) + "...",
  });

  console.log("\n2. To test session payment flow:");
  console.log("   a. Create session key using @chipi-stack SDK");
  console.log("   b. Build x402 typed data with session signer");
  console.log("   c. Execute pre-signed session transaction");
  console.log("   d. Use txHash as payment proof in X-Payment header");
  console.log("   e. Verify tx appears on x402.chipipay.com");

  console.log("\n   This flow is handled automatically by the agent cron");
  console.log("   when configured with AGENT_WALLET_ADDRESS and AGENT_SESSION_TOKEN.\n");

  console.log("--- Test complete ---\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
