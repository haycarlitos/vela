import {
  starkSnip12OwnerCommitment,
  starkSnip12PubkeyFelts,
  type NewOwnerInput,
  type ShhhOwnerRecord,
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
  /** Key confirmed; nothing proposed yet. */
  | { kind: "confirmed" }
  /** Proposed; the 48-hour timelock is running. */
  | { kind: "waiting"; secondsLeft: number; expiresAt: number }
  /** The timelock passed: it can be activated until `expiresAt`. */
  | { kind: "ready"; expiresAt: number }
  /** Nobody activated it in time: propose again. */
  | { kind: "expired"; expiresAt: number };

/**
 * Where a trusted wallet stands. `ops` are the governance ops the proposal
 * transaction emitted (`parseOpProposedEvents` on its receipt); `now` is unix
 * seconds.
 */
export function trustedStep(params: {
  record: TrustedWalletRecord;
  owners: ShhhOwnerRecord[];
  ops: ShhhProposedOp[];
  now: number;
}): TrustedStep {
  const { record, owners, now } = params;
  const owner = findTrustedOwner(record, owners);
  if (owner) return { kind: "active", ownerId: owner.ownerId };
  const ops = params.ops.filter((op) => op.opKind === "ADD_OWNER" || op.opKind === "ADD_VERIFIER");
  if (!record.proposeTxHash || !ops.some((op) => op.opKind === "ADD_OWNER")) return { kind: "confirmed" };
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
