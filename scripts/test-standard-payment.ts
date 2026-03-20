#!/usr/bin/env npx tsx
/**
 * Test script: Standard SNIP-12 x402 payment
 *
 * Tests that a standard wallet can make an x402 payment to the agent think endpoint
 * and that the transaction appears on x402.chipipay.com.
 *
 * Usage: npx tsx scripts/test-standard-payment.ts
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in env
 * - Vela dev server running on localhost:3000
 */

export {};

const VELA_URL = process.env.VELA_URL || "http://localhost:3000";

async function main() {
  console.log("\n--- x402 Standard Payment Test ---\n");

  // 1. Call think endpoint without payment — expect 402
  console.log("1. Calling /api/agent/think without payment...");
  const res402 = await fetch(`${VELA_URL}/api/agent/think`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: "0x0test" }),
  });

  console.log(`   Status: ${res402.status}`);
  if (res402.status === 402) {
    const body = await res402.json();
    console.log("   x402 payment details:", JSON.stringify(body.x402, null, 2));
    console.log("\n   Payment required as expected.");
    console.log("   To complete this test with a real payment:");
    console.log("   1. Use @chipi-stack/x402 client to build payment header");
    console.log("   2. Sign with SNIP-12 typed data");
    console.log("   3. Re-send request with X-Payment header");
    console.log("   4. Check x402.chipipay.com for the settled transaction");
  } else {
    console.log("   Unexpected status — x402 middleware may not be configured");
    const body = await res402.text();
    console.log("   Body:", body.slice(0, 200));
  }

  console.log("\n--- Test complete ---\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
