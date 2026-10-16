import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ currentUserId: vi.fn() }));
const getWallet = vi.fn();
vi.mock("@/lib/chipi", () => ({ chipi: () => ({ getWallet }) }));
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
}));

import { PATCH, POST } from "../route";
import { currentUserId } from "@/lib/auth";
import { listTrustedWallets, saveTrustedWallet, setTrustedWalletProposal } from "@/lib/db";
import { parseOpProposedEvents, waitForTransaction } from "@chipi-stack/backend";

const VELA = "0x" + "a".repeat(64);
const SIGNER = "0x" + "1".repeat(64);

function req(body: unknown) {
  return new Request("http://localhost/api/trusted-wallets", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentUserId).mockResolvedValue("user-1");
  getWallet.mockResolvedValue({ publicKey: VELA });
});

describe("POST /api/trusted-wallets", () => {
  const body = { signerAddress: SIGNER, walletName: "Bramble", starkPubkey: "0x2a", role: "GUARDIAN" };

  it("stores a confirmed key against the user's own Vela wallet", async () => {
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(saveTrustedWallet).toHaveBeenCalledWith("user-1", VELA, {
      signerAddress: SIGNER,
      walletName: "Bramble",
      starkPubkey: "0x" + "2a".padStart(64, "0"),
      role: "GUARDIAN",
    });
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
    const other = (n: number) => ({ signerAddress: "0x" + String(n).repeat(64), walletName: "x", starkPubkey: "0x1", role: "GUARDIAN" as const, proposeTxHash: null });
    vi.mocked(listTrustedWallets).mockResolvedValueOnce([other(2), other(3), other(4)]);
    expect((await POST(req(body))).status).toBe(409);
  });
});

describe("PATCH /api/trusted-wallets", () => {
  const TX = "0x" + "b".repeat(64);

  it("records the proposal only when the receipt shows ADD_OWNER on the user's wallet", async () => {
    vi.mocked(waitForTransaction).mockResolvedValueOnce({ success: true, events: [] } as never);
    vi.mocked(parseOpProposedEvents).mockReturnValueOnce([{ opKind: "ADD_OWNER" }] as never);
    const res = await PATCH(req({ signerAddress: SIGNER, proposeTxHash: TX }));
    expect(res.status).toBe(200);
    expect(parseOpProposedEvents).toHaveBeenCalledWith([], VELA);
    expect(setTrustedWalletProposal).toHaveBeenCalledWith("user-1", SIGNER, TX);
  });

  it("refuses a reverted transaction or one without ADD_OWNER", async () => {
    vi.mocked(waitForTransaction).mockResolvedValueOnce({ success: false, revertReason: "nope", events: [] } as never);
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: TX }))).status).toBe(409);
    vi.mocked(waitForTransaction).mockResolvedValueOnce({ success: true, events: [] } as never);
    vi.mocked(parseOpProposedEvents).mockReturnValueOnce([{ opKind: "ADD_VERIFIER" }] as never);
    expect((await PATCH(req({ signerAddress: SIGNER, proposeTxHash: TX }))).status).toBe(409);
    expect(setTrustedWalletProposal).not.toHaveBeenCalled();
  });

  it("null forgets an expired proposal without touching the chain", async () => {
    const res = await PATCH(req({ signerAddress: SIGNER, proposeTxHash: null }));
    expect(res.status).toBe(200);
    expect(waitForTransaction).not.toHaveBeenCalled();
    expect(setTrustedWalletProposal).toHaveBeenCalledWith("user-1", SIGNER, null);
  });
});
