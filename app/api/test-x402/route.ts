import { NextRequest, NextResponse } from "next/server";

// Standalone x402 test endpoint — no heavy dependencies
// Returns 402 with PaymentRequirement when called without X-PAYMENT header

const USDC_ASSET = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || "0x0189E2EBb955fc19bf37bD8Fc0400De24C123363E7955282bcfb99679a773E61";
const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://x402.chipipay.com";

export async function POST(req: NextRequest) {
  // Check for payment header
  const paymentHeader =
    req.headers.get("X-PAYMENT") ||
    req.headers.get("x-payment") ||
    req.headers.get("X-Payment");

  if (!paymentHeader) {
    // Return 402 Payment Required
    const paymentRequirement = {
      scheme: "exact",
      network: "starknet-mainnet",
      maxAmountRequired: "1000", // 0.001 USDC in base units (6 decimals)
      asset: USDC_ASSET,
      payTo: MERCHANT_WALLET,
      maxTimeoutSeconds: 300,
      description: "x402 test payment — $0.001 USDC",
    };

    return NextResponse.json(
      {
        error: "Payment Required",
        x402: { version: "1", ...paymentRequirement },
      },
      {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": JSON.stringify(paymentRequirement),
        },
      },
    );
  }

  // If payment provided, verify with facilitator
  try {
    const payment = JSON.parse(paymentHeader);

    const verifyRes = await fetch(`${FACILITATOR_URL}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData.valid) {
      return NextResponse.json(
        { error: "Payment verification failed", details: verifyData },
        { status: 402 },
      );
    }

    // Settle
    const settleRes = await fetch(`${FACILITATOR_URL}/api/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });

    const settleData = await settleRes.json();

    return NextResponse.json({
      success: true,
      message: "x402 payment verified and settled!",
      verification: verifyData,
      settlement: settleData,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Payment processing failed", details: String(err) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/test-x402",
    method: "POST",
    description: "x402 test endpoint. Call without X-PAYMENT header to get 402 response.",
    facilitator: FACILITATOR_URL,
    merchant: MERCHANT_WALLET,
    cost: "$0.001 USDC",
  });
}
