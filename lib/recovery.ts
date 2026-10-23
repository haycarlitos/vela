import {
  addOwnerPayload,
  removeOwnerPayload,
  rotateOwnerPayload,
  starkOwnerId,
  starkPubkeyFelts,
  type NewOwnerInput,
  type ShhhOwnerRecord,
  type ShhhPendingOp,
  type ShhhPendingRecovery,
  type ShhhProposedOp,
} from "@chipi-stack/backend";
import { PASSKEY_OWNER_ID } from "./trusted-wallets";

/**
 * Recovery after a lost passkey, with a trusted wallet (Bramble).
 *
 * Every passkey call signs as owner 0, so a recovery ends with owner 0's key
 * rotated onto a new one. The wallet refuses two owners with the same key, so
 * the guardian path goes through a temporary key R:
 *
 *   guardian:  Bramble initiates recovery to R ── 7 days ── finalize (R = owner N)
 *              ── R proposes: rotate owner 0 → K, remove N ── 24 h ── R executes
 *   co-owner:  Bramble proposes: rotate owner 0 → K ── 24 h ── Bramble executes
 *
 * Then the server checks owner 0 is K and stores K (encrypted with the new
 * passkey) on the Chipi wallet record. Until then the record is untouched.
 */
export type RecoveryPath = "guardian" | "co-owner";

/** Label of the owner a guardian recovery adds (R). */
export const RECOVERED_LABEL = "vela-recovered";

/** What Vela stores while a recovery runs (Postgres, so any device can continue). */
export interface RecoveryRecord {
  walletAddress: string;
  path: RecoveryPath;
  /** The trusted wallet that approves: the guardian, or the co-owner. */
  signerAddress: string;
  /** Its owner id on the Vela wallet. */
  signerOwnerId: number;
  /** R, the key the guardian recovers to (guardian path only). */
  recoveryPubkey: string | null;
  /** R, encrypted with the new passkey. */
  recoveryKeyEnc: string | null;
  /** K, the key owner 0 rotates onto. */
  newPubkey: string;
  /** K, encrypted with the new passkey; dropped once stored on the wallet record. */
  newKeyEnc: string | null;
  /** The new passkey (it decrypts R and K). */
  credentialId: string;
  initiateTx: string | null;
  finalizeTx: string | null;
  /** R's owner id, once the recovery is finalized. */
  recoveredOwnerId: number | null;
  proposeTx: string | null;
  rotateOpId: string | null;
  removeOpId: string | null;
  executeTx: string | null;
  completedAt: string | null;
}

function keyHash(pubkey: string): bigint {
  return starkOwnerId(BigInt(pubkey));
}

/** The owner a guardian recovery adds: R, as a full owner. */
export function recoveryNewOwner(recoveryPubkey: string): NewOwnerInput {
  return { kind: "STARK", pubkeyBytes: starkPubkeyFelts(recoveryPubkey), role: "OWNER", weight: 1, label: RECOVERED_LABEL };
}

/** `readPendingRecovery().newOwnerHash` when the pending recovery is ours. */
export function expectedRecoveryHash(recoveryPubkey: string): bigint {
  return addOwnerPayload(recoveryNewOwner(recoveryPubkey));
}

/** R on the wallet, once the recovery is finalized. */
export function findRecoveredOwner(recoveryPubkey: string, owners: ShhhOwnerRecord[]): ShhhOwnerRecord | undefined {
  const hash = keyHash(recoveryPubkey);
  return owners.find((o) => o.kind === "STARK" && !o.revoked && o.pubkeyHash === hash);
}

/** Whether owner 0, the key every passkey call signs as, is now K. */
export function ownerZeroIs(newPubkey: string, owners: ShhhOwnerRecord[]): boolean {
  const owner = owners.find((o) => o.ownerId === PASSKEY_OWNER_ID);
  return !!owner && !owner.revoked && owner.pubkeyHash === keyHash(newPubkey);
}

/**
 * The ops a propose transaction must hold: rotating owner 0 onto K, and on the
 * guardian path removing R (`recoveredOwnerId`). Anything else doesn't count.
 */
export function findRotationOps(
  record: Pick<RecoveryRecord, "path" | "newPubkey" | "recoveredOwnerId">,
  ops: ShhhProposedOp[]
): { rotate?: ShhhProposedOp; remove?: ShhhProposedOp } {
  const rotatePayload = rotateOwnerPayload(PASSKEY_OWNER_ID, keyHash(record.newPubkey));
  const rotate = ops.find((op) => op.opKind === "ROTATE_OWNER" && op.payload === rotatePayload);
  if (record.path !== "guardian" || record.recoveredOwnerId === null) return { rotate };
  const removePayload = removeOwnerPayload(record.recoveredOwnerId);
  return { rotate, remove: ops.find((op) => op.opKind === "REMOVE_OWNER" && op.payload === removePayload) };
}

export type RecoveryStep =
  /** The trusted wallet signs: initiate the recovery (guardian) or propose the rotation (co-owner). */
  | { kind: "approve" }
  /** The 7-day recovery timelock is running. */
  | { kind: "waiting-recovery"; readyAt: number }
  /** The recovery can be finalized (anyone, gasless). */
  | { kind: "finalize" }
  /** R is an owner: it proposes rotating owner 0 onto K and removing itself. */
  | { kind: "propose" }
  /** The 24-hour rotation timelock is running. */
  | { kind: "waiting-rotation"; readyAt: number; expiresAt: number }
  /** The rotation can be executed until `expiresAt`. */
  | { kind: "activate"; expiresAt: number }
  /** Owner 0 is K on-chain: store K on the wallet record. */
  | { kind: "store" }
  | { kind: "done" }
  /** Our recovery isn't pending any more and never finalized: an owner cancelled it. */
  | { kind: "cancelled" }
  /** The chain disagrees with the record in a way Vela can't fix: start over. */
  | { kind: "unknown" };

export interface RecoveryChain {
  owners: ShhhOwnerRecord[];
  /** The wallet's pending recovery (guardian path). */
  pending: ShhhPendingRecovery;
  /** The stored rotate op's state, or null if there is none. */
  rotateOp: ShhhPendingOp | null;
}

/** Where a recovery stands. `now` is unix seconds. */
export function recoveryStep(record: RecoveryRecord, chain: RecoveryChain, now: number): RecoveryStep {
  if (record.completedAt) return { kind: "done" };
  if (ownerZeroIs(record.newPubkey, chain.owners)) return { kind: "store" };

  // What to do when there is no live rotation proposal.
  let propose: RecoveryStep = { kind: "approve" };
  if (record.path === "guardian") {
    if (!record.recoveryPubkey) return { kind: "unknown" };
    if (!findRecoveredOwner(record.recoveryPubkey, chain.owners)) {
      // R is fresh, so a pending recovery to R is ours, even if its hash never reached the server.
      const ours = chain.pending.isActive && chain.pending.newOwnerHash === expectedRecoveryHash(record.recoveryPubkey);
      if (ours) {
        return now < chain.pending.validAfter ? { kind: "waiting-recovery", readyAt: chain.pending.validAfter } : { kind: "finalize" };
      }
      return record.initiateTx ? { kind: "cancelled" } : { kind: "approve" };
    }
    propose = { kind: "propose" };
  }

  const op = record.rotateOpId ? chain.rotateOp : null;
  if (!op) return propose;
  // Executed, yet owner 0 isn't K (checked above): something else changed owner 0.
  if (op.executed) return { kind: "unknown" };
  // Cancelled or let expire: propose again.
  if (op.cancelled || now >= op.expiresAt) return propose;
  if (now < op.validAfter) return { kind: "waiting-rotation", readyAt: op.validAfter, expiresAt: op.expiresAt };
  return { kind: "activate", expiresAt: op.expiresAt };
}
