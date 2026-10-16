import {
  addOwnerPayload,
  starkSnip12OwnerCommitment,
  starkSnip12PubkeyFelts,
  type NewOwnerInput,
  type ShhhOwnerRecord,
  type ShhhPendingOp,
  type ShhhProposedOp,
} from "@chipi-stack/backend";

/**
 * A trusted wallet is the user's own Starknet wallet (Bramble, Braavos, Ready)
 * added to their Vela wallet as a second key. It signs with
 * `wallet_signTypedData`, so it joins as the STARK_SNIP12 signer kind.
 *
 * Adding one is a two-step governance change on the wallet contract: the
 * passkey proposes it, and 48 hours later the passkey activates it. The
 * timelock gives the owner time to notice and cancel a change they didn't make.
 */
export const TRUSTED_KIND = "STARK_SNIP12";

/** The passkey is owner 0: every passkey-signed call signs as owner 0. */
export const PASSKEY_OWNER_ID = 0;

export type TrustedRole = "GUARDIAN" | "OWNER";

export const TRUSTED_ROLES: Record<TrustedRole, { name: string; can: string; label: string }> = {
  GUARDIAN: {
    name: "Recovery wallet",
    can: "If you lose your passkey, it can start a recovery that completes after 7 days, unless you cancel it with your passkey. It cannot move funds or approve anything else.",
    label: "vela-recovery",
  },
  OWNER: {
    name: "Co-owner",
    can: "Can do everything your passkey can: approve and stop the agent, withdraw, and replace a lost passkey after 24 hours. Full control of the wallet.",
    label: "vela-co-owner",
  },
};

export function isTrustedRole(value: unknown): value is TrustedRole {
  return value === "GUARDIAN" || value === "OWNER";
}

/** What Vela stores between the proposal and the activation (Postgres, so any device can finish). */
export interface TrustedWalletRecord {
  /** The trusted wallet's account address, 0x + 64 hex. */
  signerAddress: string;
  /** What the wallet called itself (Bramble, Braavos, ...), for the UI. */
  walletName: string;
  /** The STARK key that signs for it, 0x hex. */
  starkPubkey: string;
  role: TrustedRole;
  /** The passkey-signed proposal, once the chain accepted it. */
  proposeTxHash: string | null;
}

/** The owner the wallet contract will add. `role` and `label` must match in propose and execute. */
export function trustedOwnerInput(record: Pick<TrustedWalletRecord, "starkPubkey" | "signerAddress" | "role">): NewOwnerInput {
  return {
    kind: TRUSTED_KIND,
    pubkeyBytes: starkSnip12PubkeyFelts(record.starkPubkey, record.signerAddress),
    role: record.role,
    weight: 1,
    label: TRUSTED_ROLES[record.role].label,
  };
}

/** The payload the ADD_OWNER op for this record commits to: it ties a proposal to this key, role and label. */
export function trustedOwnerPayload(record: Pick<TrustedWalletRecord, "starkPubkey" | "signerAddress" | "role">): bigint {
  return addOwnerPayload(trustedOwnerInput(record));
}

/** The ADD_OWNER op in a proposal's receipt that adds exactly this record, if any. */
export function findAddOwnerOp(record: TrustedWalletRecord, ops: ShhhProposedOp[]): ShhhProposedOp | undefined {
  const payload = trustedOwnerPayload(record);
  return ops.find((op) => op.opKind === "ADD_OWNER" && op.payload === payload);
}

/**
 * Whether a stored proposal can still become an owner. `pending` is the
 * ADD_OWNER op's on-chain state (`readPendingOp`), or null if the wallet has
 * no such op. Executed ones are no longer live either: the owner was added.
 */
export function isProposalLive(pending: ShhhPendingOp | null, now: number): boolean {
  return pending !== null && !pending.executed && !pending.cancelled && now < pending.expiresAt;
}

/** The on-chain owner this record became, if it is active. */
export function findTrustedOwner(
  record: Pick<TrustedWalletRecord, "starkPubkey" | "signerAddress">,
  owners: ShhhOwnerRecord[]
): ShhhOwnerRecord | undefined {
  const commitment = starkSnip12OwnerCommitment(record.starkPubkey, record.signerAddress);
  return owners.find((o) => o.kind === TRUSTED_KIND && !o.revoked && o.pubkeyHash === commitment);
}

export type TrustedStep =
  /** On the wallet. */
  | { kind: "active"; ownerId: number }
  /** The proposal's receipt or state couldn't be read: no actions until it can. */
  | { kind: "unknown" }
  /** An owner cancelled the proposal: propose again or remove. */
  | { kind: "cancelled" }
  /** Key confirmed; nothing proposed yet. */
  | { kind: "confirmed" }
  /** Proposed; the 48-hour timelock is running. */
  | { kind: "waiting"; secondsLeft: number; expiresAt: number }
  /** The timelock passed: it can be activated until `expiresAt`. */
  | { kind: "ready"; expiresAt: number }
  /** Nobody activated it in time: propose again. */
  | { kind: "expired"; expiresAt: number };

/**
 * Where a trusted wallet stands. `proposal` is what was read for its stored
 * proposal: the ops its transaction emitted (`parseOpProposedEvents` on the
 * receipt) and the ADD_OWNER op's on-chain state (`readPendingOp`), or
 * undefined if that couldn't be read. `now` is unix seconds.
 */
export function trustedStep(params: {
  record: TrustedWalletRecord;
  owners: ShhhOwnerRecord[];
  proposal: { ops: ShhhProposedOp[]; pending: ShhhPendingOp | null } | undefined;
  now: number;
}): TrustedStep {
  const { record, owners, proposal, now } = params;
  const owner = findTrustedOwner(record, owners);
  if (owner) return { kind: "active", ownerId: owner.ownerId };
  if (!record.proposeTxHash) return { kind: "confirmed" };
  if (!proposal) return { kind: "unknown" };
  // Only the op that adds exactly this key and role counts (and the verifier it needs).
  const addOwner = findAddOwnerOp(record, proposal.ops);
  if (!addOwner) return { kind: "confirmed" };
  if (proposal.pending?.cancelled) return { kind: "cancelled" };
  const ops = [addOwner, ...proposal.ops.filter((op) => op.opKind === "ADD_VERIFIER")];
  // Both ops must be executable and unexpired: the owner is checked through the verifier.
  const validAfter = Math.max(...ops.map((op) => op.validAfter));
  const expiresAt = Math.min(...ops.map((op) => op.expiresAt));
  if (now >= expiresAt) return { kind: "expired", expiresAt };
  if (now < validAfter) return { kind: "waiting", secondsLeft: validAfter - now, expiresAt };
  return { kind: "ready", expiresAt };
}

/** "47h 12m", for a countdown. */
export function formatWait(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${seconds % 60}s`;
}
