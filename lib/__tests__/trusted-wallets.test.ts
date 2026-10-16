import { describe, it, expect } from "vitest";
import { starkSnip12OwnerCommitment, type ShhhOwnerRecord, type ShhhProposedOp } from "@chipi-stack/backend";
import {
  TRUSTED_KIND,
  TRUSTED_ROLES,
  findTrustedOwner,
  formatWait,
  trustedOwnerInput,
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

  it("active once the owner is on the wallet, whatever was stored", () => {
    expect(trustedStep({ record, owners: [owner()], ops: [], now: NOW })).toEqual({ kind: "active", ownerId: 1 });
  });

  it("confirmed while nothing was proposed", () => {
    expect(trustedStep({ record: { ...record, proposeTxHash: null }, owners: [], ops: [], now: NOW }).kind).toBe("confirmed");
    // A stored hash whose receipt has no ADD_OWNER can't be activated: start over.
    expect(trustedStep({ record, owners: [], ops: [op("ADD_VERIFIER", NOW, NOW + H48)], now: NOW }).kind).toBe("confirmed");
  });

  it("waits for the later of the two timelocks", () => {
    const ops = [op("ADD_VERIFIER", NOW + 100, NOW + H48), op("ADD_OWNER", NOW + 200, NOW + H48)];
    expect(trustedStep({ record, owners: [], ops, now: NOW })).toEqual({ kind: "waiting", secondsLeft: 200, expiresAt: NOW + H48 });
  });

  it("ready from the timelock until the earlier expiry", () => {
    const ops = [op("ADD_VERIFIER", NOW - 10, NOW + 50), op("ADD_OWNER", NOW - 10, NOW + 100)];
    expect(trustedStep({ record, owners: [], ops, now: NOW })).toEqual({ kind: "ready", expiresAt: NOW + 50 });
  });

  it("expired once either op expired", () => {
    const ops = [op("ADD_VERIFIER", NOW - 100, NOW), op("ADD_OWNER", NOW - 100, NOW + 100)];
    expect(trustedStep({ record, owners: [], ops, now: NOW })).toEqual({ kind: "expired", expiresAt: NOW });
  });

  it("ignores ops of other kinds in the same transaction", () => {
    const ops = [op("ADD_OWNER", NOW - 10, NOW + 100), op("SET_THRESHOLD", NOW + 999, NOW + 5)];
    expect(trustedStep({ record, owners: [], ops, now: NOW }).kind).toBe("ready");
  });
});

describe("formatWait", () => {
  it("hours and minutes, or minutes and seconds under an hour", () => {
    expect(formatWait(47 * 3600 + 12 * 60 + 5)).toBe("47h 12m");
    expect(formatWait(125)).toBe("2m 5s");
  });
});
