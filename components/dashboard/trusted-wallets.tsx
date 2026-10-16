"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildCancelPendingOpCall,
  buildExecuteAddOwnerCall,
  buildExecuteAddVerifierClassCall,
  buildProposeAddOwnerCall,
  buildProposeAddVerifierClassCall,
  isShhhVerifierDeclared,
  parseOpProposedEvents,
  readPendingOp,
  readShhhOwners,
  readVerifierClass,
  resolveStarkSnip12Signer,
  starkSnip12ApprovalTypedData,
  waitForTransaction,
  type ShhhOwnerRecord,
  type ShhhPendingOp,
  type ShhhProposedOp,
} from "@chipi-stack/backend";
import { getWalletEncryptKey, useCallAnyContract, type ChipiWalletData } from "@chipi-stack/nextjs";
import { getChipiToken } from "@/lib/auth-client";
import {
  connectWallet,
  deploymentData,
  listWallets,
  signTypedData,
  starknetProvider,
  subscribeWallets,
  walletErrorMessage,
  type DiscoveredWallet,
} from "@/lib/starknet-wallet";
import {
  PASSKEY_OWNER_ID,
  TRUSTED_KIND,
  TRUSTED_ROLES,
  findAddOwnerOp,
  formatWait,
  trustedOwnerInput,
  trustedStep,
  type TrustedRole,
  type TrustedStep,
  type TrustedWalletRecord,
} from "@/lib/trusted-wallets";

interface Proposal {
  /** Ops the proposal transaction emitted. */
  ops: ShhhProposedOp[];
  /** The ADD_OWNER op's on-chain state (null if it isn't there). */
  pending: ShhhPendingOp | null;
}

interface Chain {
  owners: ShhhOwnerRecord[];
  /** By signer address; missing when the proposal couldn't be read (the record shows "unknown"). */
  proposals: Record<string, Proposal | undefined>;
}

const hex = (value: bigint) => `0x${value.toString(16)}`;

function randomFelt(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(31)); // < 2^248: always a felt
  return BigInt(`0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`);
}

function short(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

async function api(method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch("/api/trusted-wallets", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; trustedWallets?: TrustedWalletRecord[] };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

/**
 * Your own Starknet wallet (Bramble, Braavos, Ready) as a second key of the
 * Vela wallet: a recovery wallet, or a co-owner. The passkey proposes it, the
 * wallet contract waits 48 hours, then the passkey activates it.
 */
export function TrustedWallets({ wallet }: { wallet: ChipiWalletData | null }) {
  const walletAddress = wallet?.publicKey ?? null;
  const { callAnyContractAsync } = useCallAnyContract();
  const [records, setRecords] = useState<TrustedWalletRecord[] | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState<TrustedRole>("GUARDIAN");
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** The stored records and what the chain says about them. */
  const read = useCallback(async (): Promise<{ records: TrustedWalletRecord[]; chain: Chain } | null> => {
    if (!walletAddress) return null;
    const { trustedWallets = [] } = await api("GET");
    const owners = await readShhhOwners(starknetProvider, walletAddress);
    const proposals: Chain["proposals"] = {};
    await Promise.all(
      trustedWallets
        .filter((r) => r.proposeTxHash)
        .map(async (r) => {
          try {
            // Op ids include the block time: read them back from the proposal's receipt.
            const ops = parseOpProposedEvents((await waitForTransaction(r.proposeTxHash!)).events, walletAddress);
            const addOwner = findAddOwnerOp(r, ops);
            const pending = addOwner ? await readPendingOp(starknetProvider, walletAddress, addOwner.opId) : null;
            proposals[r.signerAddress] = { ops, pending };
          } catch {
            // Left unread: that record shows "unknown" and offers no actions.
          }
        })
    );
    return { records: trustedWallets, chain: { owners, proposals } };
  }, [walletAddress]);

  const apply = (next: { records: TrustedWalletRecord[]; chain: Chain } | null) => {
    if (!next) return;
    setRecords(next.records);
    setChain(next.chain);
  };

  useEffect(() => {
    let cancelled = false;
    read()
      .then((next) => {
        if (!cancelled) apply(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [read]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!adding) return;
    const refresh = () => setWallets(listWallets());
    refresh();
    const unsubscribe = subscribeWallets(refresh);
    // Extensions can inject a moment after the page loads.
    const timer = setTimeout(refresh, 800);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [adding]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      apply(await read());
    } catch (err) {
      setStatus(null);
      setError(walletErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** One passkey prompt signs `calls` as the wallet's owner, and the chain must accept them. */
  const signWithPasskey = async (calls: Parameters<typeof callAnyContractAsync>[0]["params"]["calls"]) => {
    if (!wallet || !walletAddress) throw new Error("Your Vela wallet isn't loaded yet.");
    setStatus("Confirm with your passkey…");
    const encryptKey = await getWalletEncryptKey(wallet.credentialId ?? undefined, {
      prfSupported: wallet.prfSupported ?? undefined,
    });
    if (!encryptKey) throw new Error("Passkey confirmation was cancelled.");
    const bearerToken = await getChipiToken();
    if (!bearerToken) throw new Error("Your session expired. Sign in again.");
    const txHash = await callAnyContractAsync({
      params: { encryptKey, wallet, contractAddress: walletAddress, calls },
      bearerToken,
    });
    setStatus("Sent. Waiting for Starknet…");
    const receipt = await waitForTransaction(txHash);
    if (!receipt.success) throw new Error(`The wallet refused it: ${receipt.revertReason ?? "unknown reason"}`);
    return txHash;
  };

  // 1. The wallet signs one approval; the key that verifies it is the one we add.
  const confirmKey = (discovered: DiscoveredWallet) =>
    run(async () => {
      if (!walletAddress) return;
      setStatus(`Connect ${discovered.name}…`);
      const connected = await connectWallet(discovered);
      if (BigInt(connected.address) === BigInt(walletAddress)) throw new Error("Pick a different wallet than your Vela wallet.");
      setStatus(`Sign once in ${connected.name} so Vela can read its key. This approves nothing.`);
      const messageHash = randomFelt();
      const signature = await signTypedData(connected, starkSnip12ApprovalTypedData({ walletAddress, messageHash }));
      const { starkPubkey } = await resolveStarkSnip12Signer({
        provider: starknetProvider,
        signerAddress: connected.address,
        walletAddress,
        messageHash,
        signature,
        // A new account (not deployed yet) carries its key in its deployment data.
        deploymentData: await deploymentData(connected),
      });
      await api("POST", { signerAddress: connected.address, walletName: connected.name, starkPubkey: hex(starkPubkey), role });
      setAdding(false);
      setStatus(`${connected.name}'s key is confirmed. Propose it with your passkey.`);
    });

  // 2. One passkey prompt proposes the signer kind (first time only) and the new owner.
  const propose = (record: TrustedWalletRecord) =>
    run(async () => {
      if (!walletAddress) return;
      if (!(await isShhhVerifierDeclared(starknetProvider, TRUSTED_KIND))) {
        throw new Error("This network can't verify wallet signatures yet (the STARK_SNIP12 verifier isn't declared).");
      }
      const calls = [];
      if ((await readVerifierClass(starknetProvider, walletAddress, TRUSTED_KIND)) === 0n) {
        calls.push(buildProposeAddVerifierClassCall({ walletAddress, proposer: PASSKEY_OWNER_ID, kind: TRUSTED_KIND }));
      }
      calls.push(buildProposeAddOwnerCall({ walletAddress, proposer: PASSKEY_OWNER_ID, newOwner: trustedOwnerInput(record) }));
      const txHash = await signWithPasskey(calls);
      await api("PATCH", { signerAddress: record.signerAddress, proposeTxHash: txHash });
      setStatus("Proposed. Your wallet contract waits 48 hours before it can be activated.");
    });

  // 3. After 48 hours: the signer kind first (the new owner is checked through it), then the owner.
  const activate = (record: TrustedWalletRecord, ops: ShhhProposedOp[]) =>
    run(async () => {
      if (!walletAddress) return;
      const addVerifier = ops.find((op) => op.opKind === "ADD_VERIFIER");
      const addOwner = findAddOwnerOp(record, ops);
      if (!addOwner) throw new Error("No proposal found. Propose it again.");
      const calls = [];
      // Activation calls are open to anyone: someone may have run this one already.
      if (addVerifier && (await readVerifierClass(starknetProvider, walletAddress, TRUSTED_KIND)) === 0n) {
        calls.push(buildExecuteAddVerifierClassCall({ walletAddress, opId: addVerifier.opId, kind: TRUSTED_KIND }));
      }
      calls.push(buildExecuteAddOwnerCall({ walletAddress, opId: addOwner.opId, newOwner: trustedOwnerInput(record) }));
      await signWithPasskey(calls);
      setStatus(`${record.walletName} is now your ${TRUSTED_ROLES[record.role].name.toLowerCase()}.`);
    });

  // Removing a pending proposal must cancel it on-chain: activation is open to anyone after 48 hours.
  const remove = (record: TrustedWalletRecord, step: TrustedStep, ops: ShhhProposedOp[]) =>
    run(async () => {
      if (!walletAddress) return;
      if (step.kind === "waiting" || step.kind === "ready") {
        // Cancel the op that adds this wallet. A pending verifier op is harmless (the class is
        // already declared) and may have run already, which would make cancelling it revert.
        const addOwner = findAddOwnerOp(record, ops);
        if (addOwner) await signWithPasskey([buildCancelPendingOpCall({ walletAddress, opId: addOwner.opId })]);
      }
      await api("DELETE", { signerAddress: record.signerAddress });
      setStatus(`${record.walletName} removed.`);
    });

  const proposeAgain = (record: TrustedWalletRecord) =>
    run(async () => {
      await api("PATCH", { signerAddress: record.signerAddress, proposeTxHash: null });
    });

  if (!walletAddress) return null;

  return (
    <div className="glass p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Trusted wallets</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Add the Starknet wallet you already use as a second key, so losing your passkey doesn&apos;t lock you out. Its
          key never leaves it.
        </p>
      </div>

      {!records || !chain ? (
        <p className="text-sm text-[var(--text-muted)]">{error ?? "Reading your wallet's keys…"}</p>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => {
            const proposal = chain.proposals[record.signerAddress];
            const ops = proposal?.ops ?? [];
            const step = trustedStep({ record, owners: chain.owners, proposal, now });
            return (
              <li key={record.signerAddress} className="glass p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{record.walletName}</span>{" "}
                    <span className="font-mono text-[var(--text-muted)]">{short(record.signerAddress)}</span>
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">{TRUSTED_ROLES[record.role].name}</span>
                </div>
                {step.kind === "active" && <p className="text-[var(--vela-green)]">Active on your wallet.</p>}
                {step.kind === "unknown" && (
                  <p className="text-[var(--text-secondary)]">Couldn&apos;t read this proposal from Starknet. Reload to try again.</p>
                )}
                {step.kind === "confirmed" && (
                  <button
                    onClick={() => propose(record)}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium disabled:opacity-50"
                  >
                    Propose with your passkey
                  </button>
                )}
                {step.kind === "waiting" && (
                  <p className="text-[var(--text-secondary)]">
                    Proposed. You can activate it in {formatWait(step.secondsLeft)}. If you didn&apos;t do this, remove it.
                  </p>
                )}
                {step.kind === "ready" && (
                  <button
                    onClick={() => activate(record, ops)}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium disabled:opacity-50"
                  >
                    Activate with your passkey
                  </button>
                )}
                {(step.kind === "expired" || step.kind === "cancelled") && (
                  <div className="space-y-2">
                    <p className="text-[var(--text-secondary)]">
                      {step.kind === "expired"
                        ? `The proposal expired on ${new Date(step.expiresAt * 1000).toLocaleString()} before it was activated.`
                        : "The proposal was cancelled."}
                    </p>
                    <button onClick={() => proposeAgain(record)} disabled={busy} className="text-[var(--vela-blue)] hover:underline">
                      Propose again
                    </button>
                  </div>
                )}
                {step.kind !== "active" && step.kind !== "unknown" && (
                  <button
                    onClick={() => remove(record, step, ops)}
                    disabled={busy}
                    className="block text-xs text-[var(--text-muted)] hover:text-[var(--vela-red)]"
                  >
                    {step.kind === "waiting" || step.kind === "ready" ? "Cancel and remove (passkey)" : "Remove"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!adding ? (
        records && (
          <button onClick={() => setAdding(true)} disabled={busy} className="text-sm text-[var(--vela-blue)] hover:underline">
            Add a trusted wallet
          </button>
        )
      ) : (
        <div className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(TRUSTED_ROLES) as TrustedRole[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`glass p-3 text-left space-y-1 ${role === r ? "ring-2 ring-[var(--vela-blue)]" : ""}`}
              >
                <span className="font-medium block">{TRUSTED_ROLES[r].name}</span>
                <span className="text-xs text-[var(--text-secondary)] block">{TRUSTED_ROLES[r].can}</span>
              </button>
            ))}
          </div>
          {wallets.length === 0 ? (
            <p className="text-[var(--text-secondary)]">
              No Starknet wallet found in this browser. Install Bramble, Braavos or Ready, then come back.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {wallets.map((w) => (
                <button
                  key={w.name}
                  onClick={() => confirmKey(w)}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl glass disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {w.icon && <img src={w.icon} alt="" width={18} height={18} />}
                  {w.name}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setAdding(false)} disabled={busy} className="text-xs text-[var(--text-muted)] hover:underline">
            Cancel
          </button>
        </div>
      )}

      {status && <p className="text-sm text-[var(--text-secondary)]">{status}</p>}
      {error && records && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
    </div>
  );
}
