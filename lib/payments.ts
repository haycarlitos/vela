import "server-only";
import { SessionTxVerifier, type VerifyTransferResult } from "@chipi-stack/backend";
import { THINK_PRICE_BASE_UNITS, TOKENS } from "./config";
import { x402TxHashStore } from "./db";
import { treasuryAddress } from "./chipi";
import type { PaymentProof } from "./x402";

// One verifier per process; single use is enforced by Postgres, not memory.
const verifier = new SessionTxVerifier({ txHashStore: x402TxHashStore, timeoutMs: 90_000 });

/** Accept a /api/think payment only if it is on-chain, big enough, to Vela, and unused. */
export function verifyThinkPayment(proof: PaymentProof): Promise<VerifyTransferResult> {
  return verifier.verifyTransfer({
    transactionHash: proof.transactionHash,
    token: TOKENS.USDC,
    from: proof.from,
    to: treasuryAddress(),
    minAmount: THINK_PRICE_BASE_UNITS,
  });
}
