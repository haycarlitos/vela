import { NextResponse } from "next/server";
import { parseOpProposedEvents, readPendingOp, waitForTransaction } from "@chipi-stack/backend";
import { currentUserId } from "@/lib/auth";
import { chipi } from "@/lib/chipi";
import {
  deleteTrustedWallet,
  listTrustedWallets,
  saveTrustedWallet,
  setTrustedWalletProposal,
} from "@/lib/db";
import { callContract } from "@/lib/portfolio";
import { findAddOwnerOp, isProposalLive, isTrustedRole, type TrustedWalletRecord } from "@/lib/trusted-wallets";

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

/**
 * Whether a record may be forgotten: it has no proposal, or its proposal can
 * no longer add an owner (cancelled or expired, never executed). Otherwise the
 * database would stop tracking something that still matters on-chain.
 */
async function forgettable(walletAddress: string, record: TrustedWalletRecord): Promise<string | null> {
  if (!record.proposeTxHash) return null;
  const receipt = await waitForTransaction(record.proposeTxHash);
  const addOwner = receipt.success ? findAddOwnerOp(record, parseOpProposedEvents(receipt.events, walletAddress)) : undefined;
  if (!addOwner) return null;
  const pending = await readPendingOp({ callContract }, walletAddress, addOwner.opId);
  if (pending?.executed) return "this wallet was already added on-chain; it stays until it's removed from the wallet";
  if (isProposalLive(pending, Math.floor(Date.now() / 1000))) return "cancel the pending proposal on-chain first";
  return null;
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
  // A record with a proposal (pending, expired or executed) can't be overwritten:
  // the stored key and role must keep describing what is on-chain.
  if (existing.find((w) => w.signerAddress === signerAddress)?.proposeTxHash) {
    return NextResponse.json({ error: "this wallet already has a proposal; remove it first" }, { status: 409 });
  }
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

  if (body.proposeTxHash !== null && (typeof body.proposeTxHash !== "string" || !TX_HASH.test(body.proposeTxHash))) {
    return NextResponse.json({ error: "proposeTxHash must be a transaction hash or null" }, { status: 400 });
  }
  const record = (await listTrustedWallets(userId)).find((w) => w.signerAddress === signerAddress);
  if (!record) return NextResponse.json({ error: "unknown trusted wallet" }, { status: 404 });
  const wallet = await userWallet(userId);
  if (!wallet) return NextResponse.json({ error: "create your Vela wallet first" }, { status: 409 });

  // null: forget a proposal that can no longer add the owner, to propose again.
  if (body.proposeTxHash === null) {
    const blocked = await forgettable(wallet.publicKey, record);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
    await setTrustedWalletProposal(userId, signerAddress, null);
    return NextResponse.json({ ok: true });
  }

  const receipt = await waitForTransaction(body.proposeTxHash);
  if (!receipt.success) {
    return NextResponse.json({ error: `the proposal reverted: ${receipt.revertReason ?? "unknown"}` }, { status: 409 });
  }
  // The proposal must add exactly this record's key, role and label.
  if (!findAddOwnerOp(record, parseOpProposedEvents(receipt.events, wallet.publicKey))) {
    return NextResponse.json({ error: "that transaction doesn't propose this wallet on yours" }, { status: 409 });
  }

  const found = await setTrustedWalletProposal(userId, signerAddress, body.proposeTxHash);
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "unknown trusted wallet" }, { status: 404 });
}

/**
 * DELETE: forget a trusted wallet whose proposal can no longer add it
 * (none, cancelled or expired). A live proposal must be cancelled on-chain
 * first, and an added owner stays tracked until it is removed from the wallet.
 */
export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const signerAddress = felt(body.signerAddress);
  if (!signerAddress) return NextResponse.json({ error: "signerAddress is required" }, { status: 400 });
  const record = (await listTrustedWallets(userId)).find((w) => w.signerAddress === signerAddress);
  if (!record) return NextResponse.json({ ok: true });
  if (record.proposeTxHash) {
    const wallet = await userWallet(userId);
    if (!wallet) return NextResponse.json({ error: "create your Vela wallet first" }, { status: 409 });
    const blocked = await forgettable(wallet.publicKey, record);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
  }
  await deleteTrustedWallet(userId, signerAddress);
  return NextResponse.json({ ok: true });
}
