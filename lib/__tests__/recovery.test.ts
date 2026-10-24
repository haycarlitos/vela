import { describe, it, expect } from "vitest";
import {
  addOwnerPayload,
  removeOwnerPayload,
  rotateOwnerPayload,
  starkOwnerId,
  type ShhhOwnerRecord,
  type ShhhPendingOp,
  type ShhhProposedOp,
} from "@chipi-stack/backend";
import {
  RECOVERED_LABEL,
  expectedRecoveryHash,
  findRecoveredOwner,
  findRotationOps,
  ownerZeroIs,
  recoveryNewOwner,
  recoveryStep,
  type RecoveryChain,
  type RecoveryRecord,
} from "../recovery";

const NOW = 1_800_000_000;
const DAY = 86_400;
const LOST = "0x111"; // the lost passkey's key, owner 0 today
const R = "0x222"; // the key the guardian recovers to
const K = "0x333"; // the key owner 0 rotates onto

function owner(ownerId: number, pubkey: string, over: Partial<ShhhOwnerRecord> = {}): ShhhOwnerRecord {
  return {
    ownerId,
    kind: "STARK",
    pubkeyHash: starkOwnerId(BigInt(pubkey)),
    role: "OWNER",
    weight: 1,
    addedAt: NOW,
    label: "",
    revoked: false,
    ...over,
  };
}

const guardian: ShhhOwnerRecord = { ...owner(1, "0x999"), kind: "STARK_SNIP12", role: "GUARDIAN" };

const base: RecoveryRecord = {
  walletAddress: "0x5eba",
  path: "guardian",
  signerAddress: "0x0" + "1".repeat(63),
  signerOwnerId: 1,
  recoveryPubkey: R,
  recoveryKeyEnc: "enc-r",
  newPubkey: K,
  newKeyEnc: "enc-k",
  credentialId: "cred",
  initiateTx: null,
  finalizeTx: null,
  recoveredOwnerId: null,
  proposeTx: null,
  rotateOpId: null,
  removeOpId: null,
  executeTx: null,
  completedAt: null,
};

const noRecovery = { initiatedAt: 0, validAfter: 0, newOwnerHash: 0n, isActive: false };

function chain(over: Partial<RecoveryChain> = {}): RecoveryChain {
  return { owners: [owner(0, LOST), guardian], pending: noRecovery, rotateOp: null, ...over };
}

function rotateOp(over: Partial<ShhhPendingOp> = {}): ShhhPendingOp {
  return {
    opKind: "ROTATE_OWNER",
    proposer: 2,
    proposedAt: NOW,
    validAfter: NOW + DAY,
    expiresAt: NOW + 15 * DAY,
    payload: rotateOwnerPayload(0, starkOwnerId(BigInt(K))),
    executed: false,
    cancelled: false,
    ...over,
  };
}

describe("recovery owner and hashes", () => {
  it("recovers to R as a full owner with Vela's label", () => {
    const input = recoveryNewOwner(R);
    expect(input).toMatchObject({ kind: "STARK", role: "OWNER", weight: 1, label: RECOVERED_LABEL });
    expect(input.pubkeyBytes).toEqual([BigInt(R)]);
  });

  it("expects the contract's recovery commitment (the add-owner payload of R)", () => {
    expect(expectedRecoveryHash(R)).toBe(addOwnerPayload(recoveryNewOwner(R)));
    expect(expectedRecoveryHash(R)).not.toBe(expectedRecoveryHash(K));
  });

  it("finds R only while it is an active STARK owner", () => {
    expect(findRecoveredOwner(R, [owner(0, LOST), owner(2, R)])?.ownerId).toBe(2);
    expect(findRecoveredOwner(R, [owner(0, LOST), owner(2, R, { revoked: true })])).toBeUndefined();
  });

  it("knows when owner 0 is the new key", () => {
    expect(ownerZeroIs(K, [owner(0, LOST)])).toBe(false);
    expect(ownerZeroIs(K, [owner(0, K)])).toBe(true);
    expect(ownerZeroIs(K, [owner(0, K, { revoked: true })])).toBe(false);
  });
});

describe("findRotationOps", () => {
  const rotate: ShhhProposedOp = {
    opId: 10n,
    opKind: "ROTATE_OWNER",
    proposer: 2,
    payload: rotateOwnerPayload(0, starkOwnerId(BigInt(K))),
    validAfter: NOW + DAY,
    expiresAt: NOW + 15 * DAY,
  };
  const remove: ShhhProposedOp = { ...rotate, opId: 11n, opKind: "REMOVE_OWNER", payload: removeOwnerPayload(2) };

  it("takes only the rotation onto K and the removal of R", () => {
    const found = findRotationOps({ ...base, recoveredOwnerId: 2 }, [rotate, remove]);
    expect(found.rotate?.opId).toBe(10n);
    expect(found.remove?.opId).toBe(11n);
  });

  it("ignores a rotation onto another key, or the removal of another owner", () => {
    const other = { ...rotate, payload: rotateOwnerPayload(0, starkOwnerId(BigInt(R))) };
    const removeOther = { ...remove, payload: removeOwnerPayload(1) };
    expect(findRotationOps({ ...base, recoveredOwnerId: 2 }, [other, removeOther])).toEqual({ rotate: undefined, remove: undefined });
  });

  it("needs no removal on the co-owner path", () => {
    expect(findRotationOps({ ...base, path: "co-owner" }, [rotate])).toEqual({ rotate });
  });
});

describe("recoveryStep, guardian path", () => {
  const pending = { initiatedAt: NOW - DAY, validAfter: NOW + 6 * DAY, newOwnerHash: expectedRecoveryHash(R), isActive: true };
  const recovered = [owner(0, LOST), guardian, owner(2, R)];

  it("starts with the guardian's approval", () => {
    expect(recoveryStep(base, chain(), NOW)).toEqual({ kind: "approve" });
  });

  it("waits 7 days, then finalizes", () => {
    const initiated = { ...base, initiateTx: "0xi" };
    expect(recoveryStep(initiated, chain({ pending }), NOW)).toEqual({ kind: "waiting-recovery", readyAt: NOW + 6 * DAY });
    expect(recoveryStep(initiated, chain({ pending }), NOW + 6 * DAY)).toEqual({ kind: "finalize" });
  });

  it("follows a pending recovery to R even if its hash never reached the server", () => {
    expect(recoveryStep(base, chain({ pending }), NOW)).toEqual({ kind: "waiting-recovery", readyAt: NOW + 6 * DAY });
  });

  it("reports a cancelled recovery, or someone else's", () => {
    const initiated = { ...base, initiateTx: "0xi" };
    expect(recoveryStep(initiated, chain(), NOW)).toEqual({ kind: "cancelled" });
    expect(recoveryStep(initiated, chain({ pending: { ...pending, newOwnerHash: 7n } }), NOW)).toEqual({ kind: "cancelled" });
  });

  it("proposes once R is an owner, even if someone else finalized", () => {
    expect(recoveryStep({ ...base, initiateTx: "0xi" }, chain({ owners: recovered }), NOW)).toEqual({ kind: "propose" });
  });

  it("waits 24 hours on the rotation, then activates", () => {
    const proposed = { ...base, initiateTx: "0xi", recoveredOwnerId: 2, proposeTx: "0xp", rotateOpId: "0xa" };
    const c = chain({ owners: recovered, rotateOp: rotateOp() });
    expect(recoveryStep(proposed, c, NOW)).toEqual({ kind: "waiting-rotation", readyAt: NOW + DAY, expiresAt: NOW + 15 * DAY });
    expect(recoveryStep(proposed, c, NOW + DAY)).toEqual({ kind: "activate", expiresAt: NOW + 15 * DAY });
  });

  it("proposes again after a cancelled or expired rotation", () => {
    const proposed = { ...base, initiateTx: "0xi", recoveredOwnerId: 2, proposeTx: "0xp", rotateOpId: "0xa" };
    expect(recoveryStep(proposed, chain({ owners: recovered, rotateOp: rotateOp({ cancelled: true }) }), NOW)).toEqual({ kind: "propose" });
    expect(recoveryStep(proposed, chain({ owners: recovered, rotateOp: rotateOp() }), NOW + 15 * DAY)).toEqual({ kind: "propose" });
  });

  it("stores K once owner 0 is K, and is done after", () => {
    const executed = { ...base, initiateTx: "0xi", recoveredOwnerId: 2, proposeTx: "0xp", rotateOpId: "0xa", executeTx: "0xe" };
    expect(recoveryStep(executed, chain({ owners: [owner(0, K), guardian] }), NOW)).toEqual({ kind: "store" });
    expect(recoveryStep({ ...executed, completedAt: "2026-10-30" }, chain({ owners: [owner(0, K), guardian] }), NOW)).toEqual({ kind: "done" });
  });

  it("refuses a rotation that executed without making K owner 0", () => {
    const proposed = { ...base, initiateTx: "0xi", recoveredOwnerId: 2, proposeTx: "0xp", rotateOpId: "0xa" };
    expect(recoveryStep(proposed, chain({ owners: recovered, rotateOp: rotateOp({ executed: true }) }), NOW + 2 * DAY)).toEqual({ kind: "unknown" });
  });
});

describe("recoveryStep, co-owner path", () => {
  const coOwner = { ...base, path: "co-owner" as const, recoveryPubkey: null, recoveryKeyEnc: null };

  it("starts with the co-owner proposing the rotation, and again if it lapses", () => {
    expect(recoveryStep(coOwner, chain(), NOW)).toEqual({ kind: "approve" });
    const proposed = { ...coOwner, proposeTx: "0xp", rotateOpId: "0xa" };
    expect(recoveryStep(proposed, chain({ rotateOp: rotateOp({ cancelled: true }) }), NOW)).toEqual({ kind: "approve" });
  });

  it("activates after 24 hours", () => {
    const proposed = { ...coOwner, proposeTx: "0xp", rotateOpId: "0xa" };
    expect(recoveryStep(proposed, chain({ rotateOp: rotateOp() }), NOW + DAY)).toEqual({ kind: "activate", expiresAt: NOW + 15 * DAY });
  });
});
