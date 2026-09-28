// x402 for Vela's /api/think, paid with a self-sent USDC transfer.
//
// The payer (an agent with a session key) sends the transfer itself and puts
// the transaction hash in the X-PAYMENT header. Vela accepts it only after
// reading the receipt: the transaction succeeded, its Transfer event moved at
// least the price from the payer to Vela's treasury, and the hash was never
// used before (SessionTxVerifier + a primary key in Postgres). No facilitator
// sits in between, so nothing depends on a third party verifying correctly.

import { THINK_PRICE_BASE_UNITS, TOKENS } from "./config";

export const X402_VERSION = 1;
export const X402_NETWORK = "starknet-mainnet";

export interface PaymentProof {
  transactionHash: string;
  from: string;
}

const FELT = /^0x[0-9a-fA-F]{1,64}$/;

/** Body of the 402 response: what to pay, to whom, and how to prove it. */
export function paymentRequirements(payTo: string, resource: string) {
  return {
    x402Version: X402_VERSION,
    error: "X-PAYMENT header is required",
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        asset: TOKENS.USDC,
        payTo,
        maxAmountRequired: THINK_PRICE_BASE_UNITS.toString(),
        resource,
        description: "One DeFi decision from Vela's agent brain",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
        extra: {
          settlement: "self-sent-transfer",
          proof: "base64(JSON { x402Version: 1, scheme: 'exact', network, payload: { transactionHash, from } })",
        },
      },
    ],
  };
}

/** Parse X-PAYMENT. Returns null for anything malformed; never throws. */
export function parsePaymentHeader(header: string | null): PaymentProof | null {
  if (!header || header.length > 4_096) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object") return null;
  const d = decoded as Record<string, unknown>;
  if (d.x402Version !== X402_VERSION || d.scheme !== "exact" || d.network !== X402_NETWORK) return null;
  const payload = d.payload as Record<string, unknown> | undefined;
  const transactionHash = payload?.transactionHash;
  const from = payload?.from;
  if (typeof transactionHash !== "string" || !FELT.test(transactionHash)) return null;
  if (typeof from !== "string" || !FELT.test(from)) return null;
  return { transactionHash, from };
}

export function encodePaymentHeader(proof: PaymentProof): string {
  return Buffer.from(
    JSON.stringify({ x402Version: X402_VERSION, scheme: "exact", network: X402_NETWORK, payload: proof })
  ).toString("base64");
}

/** The transfer call an agent sends to pay for one decision. */
export function paymentCall(payTo: string) {
  return {
    contractAddress: TOKENS.USDC,
    entrypoint: "transfer",
    calldata: [payTo, "0x" + THINK_PRICE_BASE_UNITS.toString(16), "0x0"],
  };
}
