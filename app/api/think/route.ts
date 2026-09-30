import { NextResponse } from "next/server";
import { think } from "@/lib/brain";
import { treasuryAddress } from "@/lib/chipi";
import { verifyThinkPayment } from "@/lib/payments";
import { isStrategy, type Portfolio } from "@/lib/policy";
import { parsePaymentHeader, paymentRequirements } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/think: one DeFi decision for $0.001, paid with x402.
 *
 * For any agent, with or without a Chipi account: send $0.001 USDC to Vela's
 * treasury from the wallet you trade for, then call this with the transaction
 * hash in X-PAYMENT. See lib/x402.ts for the header format.
 *
 * Body: { portfolio: { USDC, ETH, STRK, vesuUsd } (USD values), strategy?, maxTradeUsd? }
 */
export async function POST(req: Request) {
  const proof = parsePaymentHeader(req.headers.get("x-payment"));
  if (!proof) {
    return NextResponse.json(paymentRequirements(treasuryAddress(), new URL(req.url).pathname), { status: 402 });
  }

  const body = (await req.json().catch(() => null)) as {
    portfolio?: Partial<Record<"USDC" | "ETH" | "STRK" | "vesuUsd", unknown>>;
    strategy?: unknown;
    maxTradeUsd?: unknown;
  } | null;
  const portfolio = toPortfolio(body?.portfolio);
  if (!portfolio) {
    // Validate before verifying, so a bad request never burns a payment.
    return NextResponse.json({ error: "portfolio must hold USD numbers for USDC, ETH, STRK and vesuUsd" }, { status: 400 });
  }
  const strategy = isStrategy(body?.strategy) ? body.strategy : "balanced";
  const maxTradeUsd = Number(body?.maxTradeUsd ?? 5);
  if (!(maxTradeUsd > 0)) return NextResponse.json({ error: "maxTradeUsd must be positive" }, { status: 400 });

  const payment = await verifyThinkPayment(proof);
  if (!payment.valid) {
    return NextResponse.json(
      { ...paymentRequirements(treasuryAddress(), new URL(req.url).pathname), error: payment.reason },
      { status: 402 }
    );
  }

  const { decision, riskParams, cost, model } = await think(portfolio, strategy, maxTradeUsd);
  return NextResponse.json(
    { decision, riskParams, model, aiCostUsd: cost.charged },
    { headers: { "X-PAYMENT-RESPONSE": Buffer.from(JSON.stringify({ success: true, transaction: payment.transactionHash })).toString("base64") } }
  );
}

function toPortfolio(input: Partial<Record<"USDC" | "ETH" | "STRK" | "vesuUsd", unknown>> | undefined): Portfolio | null {
  if (!input) return null;
  const usd = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const [usdc, eth, strk, vesu] = [usd(input.USDC), usd(input.ETH), usd(input.STRK), usd(input.vesuUsd ?? 0)];
  if (usdc === null || eth === null || strk === null || vesu === null) return null;
  // Balances are not needed to think; the brain only reads USD values.
  return {
    USDC: { balance: usdc, usd: usdc },
    ETH: { balance: 0, usd: eth },
    STRK: { balance: 0, usd: strk },
    vesuUsd: vesu,
  };
}
