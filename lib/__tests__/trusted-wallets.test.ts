import { describe, it, expect } from "vitest";
import {
  addOwnerPayload,
  starkSnip12OwnerCommitment,
  type ShhhOwnerRecord,
  type ShhhPendingOp,
  type ShhhProposedOp,
} from "@chipi-stack/backend";
import {
  TRUSTED_KIND,
  TRUSTED_ROLES,
  findTrustedOwner,
  formatWait,
  isProposalLive,
  trustedOwnerInput,
  trustedOwnerPayload,
  trustedStep,
  type TrustedWalletRecord,
} from "../trusted-wallets";

const record: TrustedWalletRecord = {
  signerAddress: "0x0" + "1".repeat(63),
  walletName: "Bramble",
  starkPubkey: "0x2a",
  role: "GUARDIAN",
  proposeTxHash: "0xabc",
};

const NOW = 1_800_000_000;

function owner(over: Partial<ShhhOwnerRecord> = {}): ShhhOwnerRecord {
  return {
    ownerId: 1,
    kind: TRUSTED_KIND,
    pubkeyHash: starkSnip12OwnerCommitment(record.starkPubkey, record.signerAddress),
    role: "GUARDIAN",
    weight: 1,
    addedAt: NOW,
    label: "vela-recovery",
    revoked: false,
    ...over,
  };
}

function op(opKind: string, validAfter: number, expiresAt: number): ShhhProposedOp {
  return { opId: 1n, opKind, proposer: 0, payload: 0n, validAfter, expiresAt };
}

describe("trustedOwnerInput", () => {
  it("adds the wallet as STARK_SNIP12 with [stark key, account address], weight 1 and the role's label", () => {
    expect(trustedOwnerInput(record)).toEqual({
      kind: "STARK_SNIP12",
      pubkeyBytes: [0x2an, BigInt(record.signerAddress)],
      role: "GUARDIAN",
      weight: 1,
      label: "vela-recovery",
    });
    expect(trustedOwnerInput({ ...record, role: "OWNER" }).label).toBe("vela-co-owner");
  });

  it("labels fit a felt short string (31 chars)", () => {
    for (const r of Object.values(TRUSTED_ROLES)) expect(r.label.length).toBeLessThanOrEqual(31);
  });
});

describe("findTrustedOwner", () => {
  it("matches the on-chain owner by its commitment, not by label", () => {
    expect(findTrustedOwner(record, [owner({ label: "anything" })])?.ownerId).toBe(1);
  });

  it("ignores revoked owners, other kinds and other keys", () => {
    expect(findTrustedOwner(record, [owner({ revoked: true })])).toBeUndefined();
    expect(findTrustedOwner(record, [owner({ kind: "STARK" })])).toBeUndefined();
    expect(findTrustedOwner({ ...record, starkPubkey: "0x2b" }, [owner()])).toBeUndefined();
  });
});

describe("trustedStep", () => {
  const H48 = 48 * 3600;
  const payload = trustedOwnerPayload(record);
  const addOwner = (validAfter: number, expiresAt: number, p = payload) => ({ ...op("ADD_OWNER", validAfter, expiresAt), payload: p });
  const live = (expiresAt: number): ShhhPendingOp => ({
    opKind: "ADD_OWNER",
    proposer: 0,
    proposedAt: NOW - 10,
    validAfter: NOW,
    expiresAt,
    payload,
    executed: false,
    cancelled: false,
  });
  const step = (ops: ShhhProposedOp[], pending: ShhhPendingOp | null = live(NOW + H48), r = record) =>
    trustedStep({ record: r, owners: [], proposal: { ops, pending }, now: NOW });

  it("active once the owner is on the wallet, whatever was stored", () => {
    expect(trustedStep({ record, owners: [owner()], proposal: undefined, now: NOW })).toEqual({ kind: "active", ownerId: 1 });
  });

  it("confirmed while nothing was proposed, or when no op adds exactly this key and role", () => {
    expect(trustedStep({ record: { ...record, proposeTxHash: null }, owners: [], proposal: undefined, now: NOW }).kind).toBe("confirmed");
    expect(step([op("ADD_VERIFIER", NOW, NOW + H48)]).kind).toBe("confirmed");
    // Another wallet's (or another role's) ADD_OWNER in the same receipt doesn't count.
    expect(step([addOwner(NOW, NOW + H48, payload + 1n)]).kind).toBe("confirmed");
    expect(step([addOwner(NOW - 1, NOW + H48)], live(NOW + H48), { ...record, role: "OWNER" }).kind).toBe("confirmed");
  });

  it("unknown when the stored proposal couldn't be read: no actions", () => {
    expect(trustedStep({ record, owners: [], proposal: undefined, now: NOW })).toEqual({ kind: "unknown" });
  });

  it("cancelled when an owner cancelled it on-chain", () => {
    expect(step([addOwner(NOW - 1, NOW + H48)], { ...live(NOW + H48), cancelled: true })).toEqual({ kind: "cancelled" });
  });

  it("waits for the later of the two timelocks", () => {
    const ops = [op("ADD_VERIFIER", NOW + 100, NOW + H48), addOwner(NOW + 200, NOW + H48)];
    expect(step(ops)).toEqual({ kind: "waiting", secondsLeft: 200, expiresAt: NOW + H48 });
  });

  it("ready from the timelock until the earlier expiry", () => {
    const ops = [op("ADD_VERIFIER", NOW - 10, NOW + 50), addOwner(NOW - 10, NOW + 100)];
    expect(step(ops)).toEqual({ kind: "ready", expiresAt: NOW + 50 });
  });

  it("expired once either op expired", () => {
    const ops = [op("ADD_VERIFIER", NOW - 100, NOW), addOwner(NOW - 100, NOW + 100)];
    expect(step(ops)).toEqual({ kind: "expired", expiresAt: NOW });
  });

  it("ignores ops of other kinds in the same transaction", () => {
    const ops = [addOwner(NOW - 10, NOW + 100), op("SET_THRESHOLD", NOW + 999, NOW + 5)];
    expect(step(ops).kind).toBe("ready");
  });
});

describe("isProposalLive", () => {
  const pending: ShhhPendingOp = {
    opKind: "ADD_OWNER",
    proposer: 0,
    proposedAt: NOW - 10,
    validAfter: NOW,
    expiresAt: NOW + 100,
    payload: 1n,
    executed: false,
    cancelled: false,
  };
  it("live until executed, cancelled or expired; an unknown op is not live", () => {
    expect(isProposalLive(pending, NOW)).toBe(true);
    expect(isProposalLive({ ...pending, executed: true }, NOW)).toBe(false);
    expect(isProposalLive({ ...pending, cancelled: true }, NOW)).toBe(false);
    expect(isProposalLive(pending, NOW + 100)).toBe(false);
    expect(isProposalLive(null, NOW)).toBe(false);
  });
});

describe("trustedOwnerPayload", () => {
  it("is the SDK's addOwnerPayload of the owner this record adds", () => {
    expect(trustedOwnerPayload(record)).toBe(addOwnerPayload(trustedOwnerInput(record)));
    expect(trustedOwnerPayload(record)).not.toBe(trustedOwnerPayload({ ...record, role: "OWNER" }));
  });
});

describe("formatWait", () => {
  it("hours and minutes, or minutes and seconds under an hour", () => {
    expect(formatWait(47 * 3600 + 12 * 60 + 5)).toBe("47h 12m");
    expect(formatWait(125)).toBe("2m 5s");
  });
});
