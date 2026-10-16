import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ currentUserId: vi.fn() }));
const getWallet = vi.fn();
vi.mock("@/lib/chipi", () => ({ chipi: () => ({ getWallet }) }));
vi.mock("@/lib/portfolio", () => ({ callContract: vi.fn() }));
vi.mock("@/lib/db", () => ({
  listTrustedWallets: vi.fn(async () => []),
  saveTrustedWallet: vi.fn(async () => {}),
  setTrustedWalletProposal: vi.fn(async () => true),
  deleteTrustedWallet: vi.fn(async () => {}),
}));
vi.mock("@chipi-stack/backend", async (orig) => ({
  ...(await orig<typeof import("@chipi-stack/backend")>()),
  waitForTransaction: vi.fn(),
  parseOpProposedEvents: vi.fn(),
  readPendingOp: vi.fn(),
}));

import { DELETE, PATCH, POST } from "../route";
import { currentUserId } from "@/lib/auth";
import { deleteTrustedWallet, listTrustedWallets, saveTrustedWallet, setTrustedWalletProposal } from "@/lib/db";
import { parseOpProposedEvents, readPendingOp, waitForTransaction, type ShhhPendingOp } from "@chipi-stack/backend";
import { trustedOwnerPayload, type TrustedWalletRecord } from "@/lib/trusted-wallets";

const VELA = "0x" + "a".repeat(64);
const SIGNER = "0x" + "1".repeat(64);
const TX = "0x" + "b".repeat(64);
const NOW = Math.floor(Date.now() / 1000);

const record: TrustedWalletRecord = {
  signerAddress: SIGNER,
  walletName: "Bramble",
  starkPubkey: "0x" + "2a".padStart(64, "0"),
  role: "GUARDIAN",
  proposeTxHash: null,
};
const proposed: TrustedWalletRecord = { ...record, proposeTxHash: TX };
const addOwnerOp = (payload = trustedOwnerPayload(record)) => ({ opId: 7n, opKind: "ADD_OWNER", proposer: 0, payload, validAfter: NOW, expiresAt: NOW + 1000 });
const pending = (over: Partial<ShhhPendingOp> = {}): ShhhPendingOp => ({
  opKind: "ADD_OWNER",
  proposer: 0,
  proposedAt: NOW - 10,
  validAfter: NOW,
  expiresAt: NOW + 1000,
  payload: trustedOwnerPayload(record),
  executed: false,
  cancelled: false,
  ...over,
});

function req(body: unknown) {
  return new Request("http://localhost/api/trusted-wallets", { method: "POST", body: JSON.stringify(body) });
}

/** The stored proposal's receipt holds this record's ADD_OWNER op, whose on-chain state is `state`. */
function onChain(state: ShhhPendingOp | null) {
  vi.mocked(waitForTransaction).mockResolvedValue({ success: true, events: [] } as never);
  vi.mocked(parseOpProposedEvents).mockReturnValue([addOwnerOp()] as never);
  vi.mocked(readPendingOp).mockResolvedValue(state);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(currentUserId).mockResolvedValue("user-1");
  vi.mocked(listTrustedWallets).mockResolvedValue([]);
  vi.mocked(setTrustedWalletProposal).mockResolvedValue(true);
  getWallet.mockResolvedValue({ publicKey: VELA });
});

describe("POST /api/trusted-wallets", () => {
  const body = { signerAddress: SIGNER, walletName: "Bramble", starkPubkey: "0x2a", role: "GUARDIAN" };

  it("stores a confirmed key against the user's own Vela wallet", async () => {
    expect((await POST(req(body))).status).toBe(200);
    expect(saveTrustedWallet).toHaveBeenCalledWith("user-1", VELA, {
      signerAddress: SIGNER,
      walletName: "Bramble",
      starkPubkey: record.starkPubkey,
      role: "GUARDIAN",
    });
  });

  it("re-confirming a wallet without a proposal replaces it (e.g. another role)", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([record]);
    expect((await POST(req({ ...body, role: "OWNER" }))).status).toBe(200);
  });

  it("refuses to overwrite a wallet that has a proposal (pending, expired or executed)", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([proposed]);
    expect((await POST(req({ ...body, role: "OWNER" }))).status).toBe(409);
    expect(saveTrustedWallet).not.toHaveBeenCalled();
  });

  it("401 signed out; 400 on a bad role, a zero key or the Vela wallet itself", async () => {
    vi.mocked(currentUserId).mockResolvedValueOnce(null);
    expect((await POST(req(body))).status).toBe(401);
    expect((await POST(req({ ...body, role: "ADMIN" }))).status).toBe(400);
    expect((await POST(req({ ...body, starkPubkey: "0x0" }))).status).toBe(400);
    expect((await POST(req({ ...body, signerAddress: VELA }))).status).toBe(400);
    expect(saveTrustedWallet).not.toHaveBeenCalled();
  });

  it("at most 3 trusted wallets", async () => {
    const other = (n: number): TrustedWalletRecord => ({ ...record, signerAddress: "0x" + String(n).repeat(64) });
    vi.mocked(listTrustedWallets).mockResolvedValue([other(2), other(3), other(4)]);
    expect((await POST(req(body))).status).toBe(409);
  });
});

describe("PATCH /api/trusted-wallets", () => {
  it("records the proposal only when its receipt adds exactly this key and role", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([record]);
    vi.mocked(waitForTransaction).mockResolvedValue({ success: true, events: [] } as never);
    vi.mocked(parseOpProposedEvents).mockReturnValue([addOwnerOp()] as never);
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: TX }))).status).toBe(200);
    expect(parseOpProposedEvents).toHaveBeenCalledWith([], VELA);
    expect(setTrustedWalletProposal).toHaveBeenCalledWith("user-1", SIGNER, TX);
  });

  it("refuses another wallet's proposal, a reverted one, or an unknown record", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([record]);
    vi.mocked(waitForTransaction).mockResolvedValue({ success: true, events: [] } as never);
    vi.mocked(parseOpProposedEvents).mockReturnValue([addOwnerOp(123n)] as never);
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: TX }))).status).toBe(409);
    vi.mocked(waitForTransaction).mockResolvedValue({ success: false, revertReason: "nope", events: [] } as never);
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: TX }))).status).toBe(409);
    vi.mocked(listTrustedWallets).mockResolvedValue([]);
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: TX }))).status).toBe(404);
    expect(setTrustedWalletProposal).not.toHaveBeenCalled();
  });

  it("null forgets an expired or cancelled proposal", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([proposed]);
    onChain(pending({ expiresAt: NOW - 1 }));
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: null }))).status).toBe(200);
    onChain(pending({ cancelled: true }));
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: null }))).status).toBe(200);
    expect(setTrustedWalletProposal).toHaveBeenCalledWith("user-1", SIGNER, null);
  });

  it("null is refused while the proposal is live or after it was executed", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([proposed]);
    onChain(pending());
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: null }))).status).toBe(409);
    onChain(pending({ executed: true }));
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: null }))).status).toBe(409);
    expect(setTrustedWalletProposal).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/trusted-wallets", () => {
  it("deletes a record with no proposal without touching the chain", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([record]);
    expect((await DELETE(req({ signerAddress: SIGNER }))).status).toBe(200);
    expect(waitForTransaction).not.toHaveBeenCalled();
    expect(deleteTrustedWallet).toHaveBeenCalledWith("user-1", SIGNER);
  });

  it("deletes once the proposal was cancelled on-chain", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([proposed]);
    onChain(pending({ cancelled: true }));
    expect((await DELETE(req({ signerAddress: SIGNER }))).status).toBe(200);
    expect(deleteTrustedWallet).toHaveBeenCalled();
  });

  it("refuses while the proposal is live, or once the owner was added", async () => {
    vi.mocked(listTrustedWallets).mockResolvedValue([proposed]);
    onChain(pending());
    expect((await DELETE(req({ signerAddress: SIGNER }))).status).toBe(409);
    onChain(pending({ executed: true }));
    expect((await DELETE(req({ signerAddress: SIGNER }))).status).toBe(409);
    expect(deleteTrustedWallet).not.toHaveBeenCalled();
  });
});
