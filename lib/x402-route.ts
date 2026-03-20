import { NextRequest, NextResponse } from "next/server";
import { FACILITATOR_URL, MERCHANT_WALLET } from "@/lib/config";

// USDC mainnet address (for PaymentRequirement)
const USDC_ASSET = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";

interface X402PaymentConfig {
  amount: string; // USD amount (e.g., "0.001")
  recipient?: string; // Defaults to MERCHANT_WALLET
  description?: string;
}

// Convert human-readable USDC to base units (6 decimals)
function usdcToBaseUnits(amount: string): string {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt((whole || "0") + fracPadded).toString();
}

// Verify x402 payment with the facilitator
async function verifyX402Payment(paymentPayload: string): Promise<{
  valid: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const payment = JSON.parse(paymentPayload);
    const response = await fetch(`${FACILITATOR_URL}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });

    const data = await response.json();
    if (!response.ok) {
      return { valid: false, error: data.reason ?? data.error ?? `Status ${response.status}` };
    }
    return { valid: data.valid ?? true, txHash: data.txHash };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

// Settle x402 payment (execute the on-chain transaction)
async function settleX402Payment(paymentPayload: string): Promise<{
  settled: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const payment = JSON.parse(paymentPayload);
    const response = await fetch(`${FACILITATOR_URL}/api/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });

    const data = await response.json();
    if (!response.ok) {
      return { settled: false, error: data.error ?? `Status ${response.status}` };
    }
    return { settled: data.success ?? true, txHash: data.txHash ?? data.transactionHash };
  } catch (error) {
    return { settled: false, error: String(error) };
  }
}

// x402 payment middleware for Next.js API routes
// Follows the x402 protocol: 402 → PAYMENT-REQUIRED header → X-PAYMENT header
export function withX402Payment(
  config: X402PaymentConfig,
  handler: (req: NextRequest) => Promise<NextResponse>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Skip CORS preflight
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204 });
    }

    // Check for payment header (case-insensitive per HTTP spec)
    const paymentHeader =
      req.headers.get("X-PAYMENT") ||
      req.headers.get("x-payment") ||
      req.headers.get("X-Payment");

    const recipient = config.recipient ?? MERCHANT_WALLET;
    const maxAmountRequired = usdcToBaseUnits(config.amount);

    if (!paymentHeader) {
      // Return 402 Payment Required with PaymentRequirement
      const paymentRequirement = {
        scheme: "exact",
        network: "starknet-mainnet",
        maxAmountRequired,
        asset: USDC_ASSET,
        payTo: recipient,
        maxTimeoutSeconds: 300,
        description: config.description ?? "x402 payment required",
      };

      return NextResponse.json(
        {
          error: "Payment Required",
          x402: {
            version: "1",
            ...paymentRequirement,
          },
        },
        {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": JSON.stringify(paymentRequirement),
          },
        },
      );
    }

    // Verify payment
    const verification = await verifyX402Payment(paymentHeader);
    if (!verification.valid) {
      return NextResponse.json(
        { error: "Invalid payment", details: verification.error },
        { status: 402 },
      );
    }

    // Execute handler
    const response = await handler(req);

    // Settle payment after successful response
    const settlement = await settleX402Payment(paymentHeader);
    if (!settlement.settled) {
      console.error("x402 settlement failed:", settlement.error);
    }

    return response;
  };
}
