import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ currentUserId: vi.fn() }));
const getWallet = vi.fn();
const finalizeRecovery = vi.fn();
const updateWalletEncryption = vi.fn();
vi.mock("@/lib/chipi", () => ({ chipi: () => ({ getWallet, finalizeRecovery, updateWalletEncryption }) }));
vi.mock("@/lib/portfolio", () => ({ callContract: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getRecovery: vi.fn(),
  startRecovery: vi.fn(async () => {}),
  updateRecovery: vi.fn(async () => {}),
  completeRecovery: vi.fn(async () => {}),
  deleteRecovery: vi.fn(async () => {}),
  listTrustedWallets: vi.fn(async () => []),
}));
vi.mock("@chipi-stack/backend", async (orig) => ({
  ...(await orig<typeof import("@chipi-stack/backend")>()),
  waitForTransaction: vi.fn(),
  parseOpProposedEvents: vi.fn(),
  readPendingOp: vi.fn(async () => null),
  readPendingRecovery: vi.fn(),
  readShhhOwners: vi.fn(),
}));

import { DELETE, PATCH, POST } from "../route";
import { currentUserId } from "@/lib/auth";
import { completeRecovery, getRecovery, listTrustedWallets, startRecovery, updateRecovery } from "@/lib/db";
import {
  parseOpProposedEvents,
  readPendingRecovery,
  readShhhOwners,
  removeOwnerPayload,
  rotateOwnerPayload,
  starkOwnerId,
  starkSnip12OwnerCommitment,
  waitForTransaction,
  type ShhhOwnerRecord,
} from "@chipi-stack/backend";
import { expectedRecoveryHash, type RecoveryRecord } from "@/lib/recovery";

const VELA = "0x" + "a".repeat(64);
const SIGNER = "0x" + "1".repeat(64);
const SIGNER_KEY = "0x" + "2".repeat(64);
const TX = "0x" + "b".repeat(64);
const R = "0x" + "3".repeat(63);
const K = "0x" + "4".repeat(63);
const LOST = "0x" + "5".repeat(63);
const NOW = Math.floor(Date.now() / 1000);

function stark(ownerId: number, pubkey: string, over: Partial<ShhhOwnerRecord> = {}): ShhhOwnerRecord {
  return { ownerId, kind: "STARK", pubkeyHash: starkOwnerId(BigInt(pubkey)), role: "OWNER", weight: 1, addedAt: NOW, label: "", revoked: false, ...over };
}
const guardian: ShhhOwnerRecord = {
  ownerId: 1,
  kind: "STARK_SNIP12",
  pubkeyHash: starkSnip12OwnerCommitment(SIGNER_KEY, SIGNER),
  role: "GUARDIAN",
  weight: 1,
  addedAt: NOW,
  label: "vela-recovery",
  revoked: false,
};
const noRecovery = { initiatedAt: 0, validAfter: 0, newOwnerHash: 0n, isActive: false };

const record: RecoveryRecord = {
  walletAddress: VELA,
  path: "guardian",
  signerAddress: SIGNER,
  signerOwnerId: 1,
  recoveryPubkey: R,
  recoveryKeyEnc: "enc-r",
  newPubkey: K,
  newKeyEnc: "enc-k",
  credentialId: "cred-new",
  initiateTx: null,
  finalizeTx: null,
  recoveredOwnerId: null,
  proposeTx: null,
  rotateOpId: null,
  removeOpId: null,
  executeTx: null,
  completedAt: null,
};

function req(method: string, body: unknown) {
  return new Request("http://localhost/api/recovery", { method, body: JSON.stringify(body) });
}

const start = {
  action: "start",
  path: "guardian",
  signerAddress: SIGNER,
  recoveryPubkey: R,
  recoveryKeyEnc: "enc-r",
  newPubkey: K,
  newKeyEnc: "enc-k",
  credentialId: "cred-new",
  prfSupported: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentUserId).mockResolvedValue("user-1");
  getWallet.mockResolvedValue({ publicKey: VELA, walletType: "SHHH" });
  vi.mocked(getRecovery).mockResolvedValue(null);
  vi.mocked(readShhhOwners).mockResolvedValue([stark(0, LOST), guardian]);
  vi.mocked(readPendingRecovery).mockResolvedValue(noRecovery);
  vi.mocked(listTrustedWallets).mockResolvedValue([
    { signerAddress: SIGNER, walletName: "Bramble", starkPubkey: SIGNER_KEY, role: "GUARDIAN", proposeTxHash: TX },
  ]);
  vi.mocked(waitForTransaction).mockResolvedValue({ success: true, events: [] } as never);
});

describe("POST start", () => {
  it("remembers the recovery with the guardian's on-chain owner id", async () => {
    const res = await POST(req("POST", start));
    expect(res.status).toBe(200);
    expect(startRecovery).toHaveBeenCalledWith("user-1", expect.objectContaining({ path: "guardian", signerOwnerId: 1, walletAddress: VELA }));
  });

  it("refuses a passkey without PRF: the server could derive that key", async () => {
    const res = await POST(req("POST", { ...start, prfSupported: false }));
    expect(res.status).toBe(400);
    expect(startRecovery).not.toHaveBeenCalled();
  });

  it("refuses a wallet that isn't an active guardian", async () => {
    vi.mocked(readShhhOwners).mockResolvedValue([stark(0, LOST)]);
    expect((await POST(req("POST", start))).status).toBe(409);
    vi.mocked(listTrustedWallets).mockResolvedValue([]);
    expect((await POST(req("POST", start))).status).toBe(404);
    expect(startRecovery).not.toHaveBeenCalled();
  });

  it("refuses the co-owner path for a guardian", async () => {
    const res = await POST(req("POST", { ...start, path: "co-owner" }));
    expect(res.status).toBe(409);
  });

  it("refuses to start over while a recovery is pending on-chain", async () => {
    vi.mocked(getRecovery).mockResolvedValue({ ...record, initiateTx: TX });
    vi.mocked(readPendingRecovery).mockResolvedValue({ initiatedAt: NOW, validAfter: NOW + 7 * 86400, newOwnerHash: expectedRecoveryHash(R), isActive: true });
    expect((await POST(req("POST", start))).status).toBe(409);
    expect(startRecovery).not.toHaveBeenCalled();
  });

  it("refuses an account without a Vela wallet (signed in with an unlinked Starknet wallet)", async () => {
    getWallet.mockResolvedValue(null);
    expect((await POST(req("POST", start))).status).toBe(409);
  });
});

describe("PATCH initiated", () => {
  beforeEach(() => vi.mocked(getRecovery).mockResolvedValue(record));

  it("records a recovery pending to exactly R", async () => {
    vi.mocked(readPendingRecovery).mockResolvedValue({ initiatedAt: NOW, validAfter: NOW + 7 * 86400, newOwnerHash: expectedRecoveryHash(R), isActive: true });
    expect((await PATCH(req("PATCH", { action: "initiated", txHash: TX }))).status).toBe(200);
    expect(updateRecovery).toHaveBeenCalledWith("user-1", { initiateTx: TX });
  });

  it("refuses a recovery to another key", async () => {
    vi.mocked(readPendingRecovery).mockResolvedValue({ initiatedAt: NOW, validAfter: NOW + 7 * 86400, newOwnerHash: expectedRecoveryHash(K), isActive: true });
    expect((await PATCH(req("PATCH", { action: "initiated", txHash: TX }))).status).toBe(409);
    expect(updateRecovery).not.toHaveBeenCalled();
  });
});

describe("POST finalize", () => {
  it("finalizes only once the 7 days are over, then records R's owner id", async () => {
    vi.mocked(getRecovery).mockResolvedValue({ ...record, initiateTx: TX });
    vi.mocked(readPendingRecovery).mockResolvedValue({ initiatedAt: NOW - 8 * 86400, validAfter: NOW - 86400, newOwnerHash: expectedRecoveryHash(R), isActive: true });
    finalizeRecovery.mockResolvedValue(TX);
    vi.mocked(readShhhOwners)
      .mockResolvedValueOnce([stark(0, LOST), guardian]) // load
      .mockResolvedValueOnce([stark(0, LOST), guardian, stark(2, R)]); // after finalize
    const res = await POST(req("POST", { action: "finalize" }));
    expect(res.status).toBe(200);
    expect(finalizeRecovery).toHaveBeenCalled();
    expect(updateRecovery).toHaveBeenCalledWith("user-1", { finalizeTx: TX, recoveredOwnerId: 2 });
  });

  it("refuses before the 7 days are over", async () => {
    vi.mocked(getRecovery).mockResolvedValue({ ...record, initiateTx: TX });
    vi.mocked(readPendingRecovery).mockResolvedValue({ initiatedAt: NOW, validAfter: NOW + 6 * 86400, newOwnerHash: expectedRecoveryHash(R), isActive: true });
    expect((await POST(req("POST", { action: "finalize" }))).status).toBe(409);
    expect(finalizeRecovery).not.toHaveBeenCalled();
  });
});

describe("PATCH proposed", () => {
  const finalized = { ...record, initiateTx: TX, finalizeTx: TX, recoveredOwnerId: 2 };
  beforeEach(() => {
    vi.mocked(getRecovery).mockResolvedValue(finalized);
    vi.mocked(readShhhOwners).mockResolvedValue([stark(0, LOST), guardian, stark(2, R)]);
  });

  const op = { proposer: 2, validAfter: NOW + 86400, expiresAt: NOW + 15 * 86400 };

  it("records the rotation onto K and the removal of R", async () => {
    vi.mocked(parseOpProposedEvents).mockReturnValue([
      { ...op, opId: 0xa1n, opKind: "ROTATE_OWNER", payload: rotateOwnerPayload(0, starkOwnerId(BigInt(K))) },
      { ...op, opId: 0xa2n, opKind: "REMOVE_OWNER", payload: removeOwnerPayload(2) },
    ]);
    expect((await PATCH(req("PATCH", { action: "proposed", txHash: TX }))).status).toBe(200);
    expect(updateRecovery).toHaveBeenCalledWith("user-1", { proposeTx: TX, rotateOpId: "0xa1", removeOpId: "0xa2", recoveredOwnerId: 2 });
  });

  it("refuses a rotation onto another key", async () => {
    vi.mocked(parseOpProposedEvents).mockReturnValue([
      { ...op, opId: 0xa1n, opKind: "ROTATE_OWNER", payload: rotateOwnerPayload(0, starkOwnerId(BigInt(LOST))) },
      { ...op, opId: 0xa2n, opKind: "REMOVE_OWNER", payload: removeOwnerPayload(2) },
    ]);
    expect((await PATCH(req("PATCH", { action: "proposed", txHash: TX }))).status).toBe(409);
    expect(updateRecovery).not.toHaveBeenCalled();
  });
});

describe("PATCH executed", () => {
  beforeEach(() => vi.mocked(getRecovery).mockResolvedValue({ ...record, initiateTx: TX, recoveredOwnerId: 2, proposeTx: TX, rotateOpId: "0xa1" }));

  it("never touches the Chipi wallet record while owner 0 isn't K", async () => {
    vi.mocked(readShhhOwners).mockResolvedValue([stark(0, LOST), guardian, stark(2, R)]);
    expect((await PATCH(req("PATCH", { action: "executed", txHash: TX }))).status).toBe(409);
    expect(updateWalletEncryption).not.toHaveBeenCalled();
    expect(completeRecovery).not.toHaveBeenCalled();
  });

  it("stores K with the new passkey once owner 0 is K, then drops the ciphertexts", async () => {
    vi.mocked(readShhhOwners).mockResolvedValue([stark(0, K), guardian]);
    updateWalletEncryption.mockResolvedValue({ success: true });
    expect((await PATCH(req("PATCH", { action: "executed", txHash: TX }))).status).toBe(200);
    expect(updateWalletEncryption).toHaveBeenCalledWith({
      externalUserId: "user-1",
      publicKey: VELA,
      newEncryptedPrivateKey: "enc-k",
      credentialId: "cred-new",
      prfSupported: true,
      authMethod: "passkey",
    });
    expect(completeRecovery).toHaveBeenCalledWith("user-1");
  });

  it("keeps the recovery when Chipi refuses the update", async () => {
    vi.mocked(readShhhOwners).mockResolvedValue([stark(0, K), guardian]);
    updateWalletEncryption.mockResolvedValue({ success: false });
    expect((await PATCH(req("PATCH", { action: "executed", txHash: TX }))).status).toBe(502);
    expect(completeRecovery).not.toHaveBeenCalled();
  });
});

describe("DELETE", () => {
  it("refuses while the recovery runs on-chain", async () => {
    vi.mocked(getRecovery).mockResolvedValue({ ...record, initiateTx: TX });
    vi.mocked(readPendingRecovery).mockResolvedValue({ initiatedAt: NOW, validAfter: NOW + 7 * 86400, newOwnerHash: expectedRecoveryHash(R), isActive: true });
    expect((await DELETE()).status).toBe(409);
  });

  it("forgets one that never started", async () => {
    vi.mocked(getRecovery).mockResolvedValue(record);
    expect((await DELETE()).status).toBe(200);
  });
});
