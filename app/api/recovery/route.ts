import { NextResponse } from "next/server";
import {
  parseOpProposedEvents,
  readPendingOp,
  readPendingRecovery,
  readShhhOwners,
  waitForTransaction,
} from "@chipi-stack/backend";
import { currentUserId } from "@/lib/auth";
import { chipi } from "@/lib/chipi";
import { completeRecovery, deleteRecovery, getRecovery, listTrustedWallets, startRecovery, updateRecovery } from "@/lib/db";
import { callContract } from "@/lib/portfolio";
import {
  expectedRecoveryHash,
  findRecoveredOwner,
  findRotationOps,
  ownerZeroIs,
  recoveryNewOwner,
  recoveryStep,
  type RecoveryChain,
  type RecoveryPath,
  type RecoveryRecord,
  type RecoveryStep,
} from "@/lib/recovery";
import { findTrustedOwner } from "@/lib/trusted-wallets";

export const dynamic = "force-dynamic";

const FELT = /^0x[0-9a-fA-F]{1,64}$/;
const provider = { callContract };

function felt(value: unknown): string | null {
  return typeof value === "string" && FELT.test(value) ? `0x${BigInt(value).toString(16).padStart(64, "0")}` : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

async function userWallet(userId: string) {
  return (await chipi().getWallet({ externalUserId: userId })) ?? null;
}

async function readChain(record: RecoveryRecord): Promise<RecoveryChain> {
  const [owners, pending, rotateOp] = await Promise.all([
    readShhhOwners(provider, record.walletAddress),
    readPendingRecovery(provider, record.walletAddress),
    record.rotateOpId ? readPendingOp(provider, record.walletAddress, BigInt(record.rotateOpId)) : Promise.resolve(null),
  ]);
  return { owners, pending, rotateOp };
}

/** The record and where it stands, or a 503 when Starknet can't be read. */
async function load(userId: string): Promise<{ record: RecoveryRecord; chain: RecoveryChain; step: RecoveryStep } | null | NextResponse> {
  const record = await getRecovery(userId);
  if (!record) return null;
  try {
    const chain = await readChain(record);
    return { record, chain, step: recoveryStep(record, chain, Math.floor(Date.now() / 1000)) };
  } catch (err) {
    console.error("recovery: chain read failed", err);
    return NextResponse.json({ error: "Couldn't read your wallet from Starknet right now. Try again." }, { status: 503 });
  }
}

function view(record: RecoveryRecord, chain: RecoveryChain, step: RecoveryStep) {
  return {
    recovery: {
      ...record,
      // Known from the chain even if someone else finalized.
      recoveredOwnerId:
        record.recoveredOwnerId ?? (record.recoveryPubkey ? findRecoveredOwner(record.recoveryPubkey, chain.owners)?.ownerId ?? null : null),
    },
    step,
  };
}

/** GET: the user's recovery and its step. Its keys are ciphertext only the new passkey opens. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const loaded = await load(userId);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded) return NextResponse.json({ recovery: null, step: null });
  return NextResponse.json(view(loaded.record, loaded.chain, loaded.step));
}

/**
 * POST { action: "start", ... }: remember a new recovery (keys made in the
 * browser, encrypted with a new PRF passkey). Nothing on-chain yet.
 * POST { action: "finalize" }: after the 7 days, finalize the recovery
 * (permissionless and gasless) and record R's owner id.
 */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "finalize") {
    const loaded = await load(userId);
    if (loaded instanceof NextResponse) return loaded;
    if (!loaded || loaded.step.kind !== "finalize" || !loaded.record.recoveryPubkey) {
      return NextResponse.json({ error: "there is no recovery ready to finalize" }, { status: 409 });
    }
    const { record } = loaded;
    const txHash = await chipi().finalizeRecovery({
      params: { walletAddress: record.walletAddress, newOwner: recoveryNewOwner(record.recoveryPubkey!), externalUserId: userId },
    });
    // A hash is not a result.
    const receipt = await waitForTransaction(txHash);
    if (!receipt.success) return NextResponse.json({ error: `finalize reverted: ${receipt.revertReason ?? "unknown"}` }, { status: 409 });
    const recovered = findRecoveredOwner(record.recoveryPubkey!, await readShhhOwners(provider, record.walletAddress));
    if (!recovered) return NextResponse.json({ error: "the recovered key isn't an owner after finalize" }, { status: 409 });
    await updateRecovery(userId, { finalizeTx: txHash, recoveredOwnerId: recovered.ownerId });
    return NextResponse.json({ ok: true, recoveredOwnerId: recovered.ownerId });
  }

  if (body.action !== "start") return NextResponse.json({ error: "unknown action" }, { status: 400 });

  const path = body.path as RecoveryPath;
  const signerAddress = felt(body.signerAddress);
  const newPubkey = felt(body.newPubkey);
  const newKeyEnc = text(body.newKeyEnc, 2048);
  const credentialId = text(body.credentialId, 1024);
  const recoveryPubkey = path === "guardian" ? felt(body.recoveryPubkey) : null;
  const recoveryKeyEnc = path === "guardian" ? text(body.recoveryKeyEnc, 2048) : null;
  if ((path !== "guardian" && path !== "co-owner") || !signerAddress || !newPubkey || !newKeyEnc || !credentialId) {
    return NextResponse.json({ error: "path, signerAddress, newPubkey, newKeyEnc and credentialId are required" }, { status: 400 });
  }
  if (path === "guardian" && (!recoveryPubkey || !recoveryKeyEnc || BigInt(recoveryPubkey) === BigInt(newPubkey))) {
    return NextResponse.json({ error: "a guardian recovery needs its own recovery key" }, { status: 400 });
  }
  // A key the server could derive (no PRF) would make the wallet custodial.
  if (body.prfSupported !== true) {
    return NextResponse.json({ error: "this passkey can't protect the wallet key (no PRF): use another device or browser" }, { status: 400 });
  }

  const wallet = await userWallet(userId);
  if (!wallet) return NextResponse.json({ error: "this account has no Vela wallet: sign in with the Starknet wallet you linked" }, { status: 409 });
  if (wallet.walletType !== "SHHH") return NextResponse.json({ error: "this wallet type can't be recovered" }, { status: 409 });

  const existing = await load(userId);
  if (existing instanceof NextResponse) return existing;
  const restartable = ["approve", "cancelled", "unknown", "done"];
  if (existing && !restartable.includes(existing.step.kind)) {
    return NextResponse.json({ error: "a recovery is already running: continue it" }, { status: 409 });
  }

  // The approving wallet must be one of the user's trusted wallets, active on-chain in the right role.
  const record = (await listTrustedWallets(userId)).find((w) => w.signerAddress === signerAddress);
  if (!record) return NextResponse.json({ error: "that wallet isn't one of your trusted wallets" }, { status: 404 });
  const owner = findTrustedOwner(record, await readShhhOwners(provider, wallet.publicKey));
  const role = path === "guardian" ? "GUARDIAN" : "OWNER";
  if (!owner || owner.role !== role) {
    return NextResponse.json({ error: `that wallet isn't an active ${path === "guardian" ? "recovery wallet" : "co-owner"} yet` }, { status: 409 });
  }

  await startRecovery(userId, {
    walletAddress: wallet.publicKey,
    path,
    signerAddress,
    signerOwnerId: owner.ownerId,
    recoveryPubkey,
    recoveryKeyEnc,
    newPubkey,
    newKeyEnc,
    credentialId,
  });
  return NextResponse.json({ ok: true, signerOwnerId: owner.ownerId });
}

/**
 * PATCH { action, txHash }: the browser sent a step; the chain must confirm it.
 * - initiated: the guardian's initiate_recovery, to exactly R.
 * - proposed: rotate owner 0 onto K (and, guardian path, remove R).
 * - executed: owner 0 is K. Only then is K stored on the Chipi wallet record.
 */
export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const txHash = felt(body.txHash);

  const loaded = await load(userId);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded) return NextResponse.json({ error: "no recovery in progress" }, { status: 404 });
  const { record } = loaded;

  if (body.action === "initiated") {
    if (!txHash || record.path !== "guardian" || !record.recoveryPubkey) return NextResponse.json({ error: "txHash is required" }, { status: 400 });
    const receipt = await waitForTransaction(txHash);
    if (!receipt.success) return NextResponse.json({ error: `the recovery reverted: ${receipt.revertReason ?? "unknown"}` }, { status: 409 });
    // A relayed call the wallet refused can still come back SUCCEEDED: read the state.
    const pending = await readPendingRecovery(provider, record.walletAddress);
    if (!pending.isActive || pending.newOwnerHash !== expectedRecoveryHash(record.recoveryPubkey)) {
      return NextResponse.json({ error: "the wallet has no pending recovery to your new key" }, { status: 409 });
    }
    await updateRecovery(userId, { initiateTx: txHash });
    return NextResponse.json({ ok: true, completesAt: pending.validAfter });
  }

  if (body.action === "proposed") {
    if (!txHash) return NextResponse.json({ error: "txHash is required" }, { status: 400 });
    const receipt = await waitForTransaction(txHash);
    if (!receipt.success) return NextResponse.json({ error: `the proposal reverted: ${receipt.revertReason ?? "unknown"}` }, { status: 409 });
    const recoveredOwnerId =
      record.path === "guardian" && record.recoveryPubkey
        ? findRecoveredOwner(record.recoveryPubkey, await readShhhOwners(provider, record.walletAddress))?.ownerId ?? null
        : null;
    const { rotate, remove } = findRotationOps({ ...record, recoveredOwnerId }, parseOpProposedEvents(receipt.events, record.walletAddress));
    if (!rotate || (record.path === "guardian" && !remove)) {
      return NextResponse.json({ error: "that transaction doesn't propose moving owner 0 to your new key" }, { status: 409 });
    }
    await updateRecovery(userId, {
      proposeTx: txHash,
      rotateOpId: `0x${rotate.opId.toString(16)}`,
      removeOpId: remove ? `0x${remove.opId.toString(16)}` : undefined,
      recoveredOwnerId: recoveredOwnerId ?? undefined,
    });
    return NextResponse.json({ ok: true, activatesAt: rotate.validAfter });
  }

  if (body.action === "executed") {
    if (txHash) {
      const receipt = await waitForTransaction(txHash);
      if (!receipt.success) return NextResponse.json({ error: `the activation reverted: ${receipt.revertReason ?? "unknown"}` }, { status: 409 });
    }
    // The wallet record changes only once the chain says owner 0 is K.
    if (!ownerZeroIs(record.newPubkey, await readShhhOwners(provider, record.walletAddress))) {
      return NextResponse.json({ error: "owner 0 isn't your new key yet" }, { status: 409 });
    }
    if (!record.newKeyEnc) return NextResponse.json({ ok: true });
    const result = await chipi().updateWalletEncryption({
      externalUserId: userId,
      publicKey: record.walletAddress,
      newEncryptedPrivateKey: record.newKeyEnc,
      credentialId: record.credentialId,
      prfSupported: true,
      authMethod: "passkey",
    });
    if (result?.success === false) return NextResponse.json({ error: "Chipi didn't store the new key; try again" }, { status: 502 });
    await updateRecovery(userId, { executeTx: txHash ?? undefined });
    await completeRecovery(userId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

/** DELETE: forget a recovery that hasn't started on-chain, was cancelled, or is done. */
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const loaded = await load(userId);
  if (loaded instanceof NextResponse) return loaded;
  if (loaded && !["approve", "cancelled", "unknown", "done"].includes(loaded.step.kind)) {
    return NextResponse.json({ error: "this recovery is running on-chain; finish it or cancel it from the dashboard" }, { status: 409 });
  }
  await deleteRecovery(userId);
  return NextResponse.json({ ok: true });
}
