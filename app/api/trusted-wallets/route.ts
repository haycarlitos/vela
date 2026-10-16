import { NextResponse } from "next/server";
import { parseOpProposedEvents, waitForTransaction } from "@chipi-stack/backend";
import { currentUserId } from "@/lib/auth";
import { chipi } from "@/lib/chipi";
import {
  deleteTrustedWallet,
  listTrustedWallets,
  saveTrustedWallet,
  setTrustedWalletProposal,
} from "@/lib/db";
import { isTrustedRole } from "@/lib/trusted-wallets";

export const dynamic = "force-dynamic";

/** A user doesn't need more backups than this, and it bounds what we store. */
const MAX_TRUSTED_WALLETS = 3;

const FELT = /^0x[0-9a-fA-F]{1,64}$/;
const TX_HASH = /^0x[0-9a-fA-F]{1,64}$/;

function felt(value: unknown): string | null {
  return typeof value === "string" && FELT.test(value) ? `0x${BigInt(value).toString(16).padStart(64, "0")}` : null;
}

async function userWallet(userId: string) {
  return (await chipi().getWallet({ externalUserId: userId })) ?? null;
}

/** GET: the user's trusted wallets, as stored. Their on-chain state is read in the browser. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ trustedWallets: await listTrustedWallets(userId) });
}

/**
 * POST: remember a wallet whose key the browser just confirmed (it signed an
 * approval and the key verified it). Nothing on-chain yet.
 */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const signerAddress = felt(body.signerAddress);
  const starkPubkey = felt(body.starkPubkey);
  const walletName = typeof body.walletName === "string" ? body.walletName.trim().slice(0, 40) : "";
  if (!signerAddress || !starkPubkey || BigInt(starkPubkey) === 0n || !walletName || !isTrustedRole(body.role)) {
    return NextResponse.json({ error: "signerAddress, starkPubkey, walletName and role are required" }, { status: 400 });
  }

  const wallet = await userWallet(userId);
  if (!wallet) return NextResponse.json({ error: "create your Vela wallet first" }, { status: 409 });
  if (BigInt(signerAddress) === BigInt(wallet.publicKey)) {
    return NextResponse.json({ error: "a wallet can't be its own trusted wallet" }, { status: 400 });
  }

  const existing = await listTrustedWallets(userId);
  if (existing.length >= MAX_TRUSTED_WALLETS && !existing.some((w) => w.signerAddress === signerAddress)) {
    return NextResponse.json({ error: `at most ${MAX_TRUSTED_WALLETS} trusted wallets` }, { status: 409 });
  }

  await saveTrustedWallet(userId, wallet.publicKey, { signerAddress, walletName, starkPubkey, role: body.role });
  return NextResponse.json({ ok: true });
}

/**
 * PATCH: record the passkey-signed proposal once the chain accepted it, or
 * forget it (`proposeTxHash: null`) after it expired. A hash is not a result:
 * the receipt must show an ADD_OWNER proposal on this user's wallet.
 */
export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const signerAddress = felt(body.signerAddress);
  if (!signerAddress) return NextResponse.json({ error: "signerAddress is required" }, { status: 400 });

  if (body.proposeTxHash === null) {
    const found = await setTrustedWalletProposal(userId, signerAddress, null);
    return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "unknown trusted wallet" }, { status: 404 });
  }
  if (typeof body.proposeTxHash !== "string" || !TX_HASH.test(body.proposeTxHash)) {
    return NextResponse.json({ error: "proposeTxHash must be a transaction hash or null" }, { status: 400 });
  }

  const wallet = await userWallet(userId);
  if (!wallet) return NextResponse.json({ error: "create your Vela wallet first" }, { status: 409 });
  const receipt = await waitForTransaction(body.proposeTxHash);
  if (!receipt.success) {
    return NextResponse.json({ error: `the proposal reverted: ${receipt.revertReason ?? "unknown"}` }, { status: 409 });
  }
  if (!parseOpProposedEvents(receipt.events, wallet.publicKey).some((op) => op.opKind === "ADD_OWNER")) {
    return NextResponse.json({ error: "that transaction proposed no new owner on your wallet" }, { status: 409 });
  }

  const found = await setTrustedWalletProposal(userId, signerAddress, body.proposeTxHash);
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "unknown trusted wallet" }, { status: 404 });
}

/** DELETE: forget a trusted wallet that was never activated. An active one stays on-chain until removed there. */
export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const signerAddress = felt(body.signerAddress);
  if (!signerAddress) return NextResponse.json({ error: "signerAddress is required" }, { status: 400 });
  await deleteTrustedWallet(userId, signerAddress);
  return NextResponse.json({ ok: true });
}
