"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  buildExecuteRemoveOwnerCall,
  buildExecuteRotateOwnerCall,
  buildInitiateRecoveryCall,
  buildProposeRemoveOwnerCall,
  buildProposeRotateOwnerCall,
  createStarkOwnerKey,
  decryptPrivateKey,
  readShhhOwners,
  starkPubkeyFelts,
  type ShhhOwnerRecord,
} from "@chipi-stack/backend";
import {
  createWalletPasskey,
  getWalletEncryptKey,
  useExternalSignerExecute,
  useStarkKeyExecute,
  type ChipiWalletData,
} from "@chipi-stack/nextjs";
import { authClient, getChipiToken } from "@/lib/auth-client";
import { formatDate } from "@/lib/notices";
import { recoveryNewOwner, type RecoveryPath, type RecoveryRecord, type RecoveryStep } from "@/lib/recovery";
import {
  connectWallet,
  listWallets,
  signTypedData,
  starknetProvider,
  subscribeWallets,
  walletErrorMessage,
  type DiscoveredWallet,
} from "@/lib/starknet-wallet";
import { PASSKEY_OWNER_ID, TRUSTED_ROLES, findTrustedOwner, formatWait, type TrustedWalletRecord } from "@/lib/trusted-wallets";

interface State {
  recovery: RecoveryRecord | null;
  step: RecoveryStep | null;
}

/** A trusted wallet that can recover this wallet, with its owner id on it. */
interface Candidate {
  record: TrustedWalletRecord;
  owner: ShhhOwnerRecord;
  path: RecoveryPath;
}

async function api<T>(method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch("/api/recovery", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

function short(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

/**
 * Recovery after a lost passkey, on any device: sign in with your Starknet
 * wallet, make a new passkey here, and your trusted wallet approves. Every
 * step is verified on-chain by the server; the wallet record changes only at
 * the end, once owner 0 is the new key.
 */
export function RecoverFlow({ userId, wallet }: { userId: string; wallet: ChipiWalletData }) {
  const walletAddress = wallet.publicKey;
  const { executeAsync: externalExecute } = useExternalSignerExecute();
  const { executeAsync: starkKeyExecute } = useStarkKeyExecute();
  const [state, setState] = useState<State | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async () => {
    const [next, trusted, owners] = await Promise.all([
      api<State>("GET"),
      fetch("/api/trusted-wallets", { cache: "no-store" }).then(async (r) => ((await r.json()) as { trustedWallets?: TrustedWalletRecord[] }).trustedWallets ?? []),
      readShhhOwners(starknetProvider, walletAddress),
    ]);
    const found: Candidate[] = [];
    for (const record of trusted) {
      const owner = findTrustedOwner(record, owners);
      if (owner) found.push({ record, owner, path: owner.role === "GUARDIAN" ? "guardian" : "co-owner" });
    }
    return { next, found };
  }, [walletAddress]);

  const apply = (loaded: { next: State; found: Candidate[] }) => {
    setState(loaded.next);
    setCandidates(loaded.found);
    setNow(Math.floor(Date.now() / 1000));
  };

  useEffect(() => {
    let cancelled = false;
    read()
      .then((loaded) => {
        if (!cancelled) apply(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [read]);

  useEffect(() => {
    const refresh = () => setWallets(listWallets());
    refresh();
    const unsubscribe = subscribeWallets(refresh);
    const timer = setTimeout(refresh, 800);
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      apply(await read());
      setStatus(null);
    } catch (err) {
      setStatus(null);
      setError(walletErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const bearer = async () => {
    const token = await getChipiToken();
    if (!token) throw new Error("Your session expired. Sign in again.");
    return token;
  };

  /** The new passkey unlocks a key Vela stored encrypted. Keep the result in memory only. */
  const unlock = async (encrypted: string | null, credentialId: string) => {
    if (!encrypted) throw new Error("This recovery's key is missing. Start over.");
    setStatus("Confirm with your new passkey…");
    const key = await getWalletEncryptKey(credentialId, { prfSupported: true });
    if (!key) throw new Error("Passkey confirmation was cancelled.");
    const privateKey = decryptPrivateKey(encrypted, key);
    if (!privateKey) throw new Error("This passkey doesn't open the recovery key. Use the passkey you made when you started.");
    return privateKey;
  };

  /** The trusted wallet signs `calls` as its owner on the Vela wallet. */
  const approveWith = async (discovered: DiscoveredWallet, recovery: RecoveryRecord, calls: ReturnType<typeof buildInitiateRecoveryCall>[]) => {
    const candidate = candidates?.find((c) => c.record.signerAddress === recovery.signerAddress);
    if (!candidate) throw new Error("That trusted wallet isn't active on your wallet anymore.");
    setStatus(`Connect ${discovered.name}…`);
    const connected = await connectWallet(discovered);
    if (BigInt(connected.address) !== BigInt(recovery.signerAddress)) {
      throw new Error(`Select the account ${short(recovery.signerAddress)} in ${discovered.name}.`);
    }
    setStatus(`Approve in ${discovered.name}…`);
    return externalExecute({
      params: {
        walletAddress,
        ownerIndex: recovery.signerOwnerId,
        calls,
        signTypedData: (typedData) => signTypedData(connected, typedData),
        signer: { address: connected.address, starkPubkey: candidate.record.starkPubkey },
      },
      bearerToken: await bearer(),
    });
  };

  // 1. A new passkey on this device, and the keys it protects. Nothing on-chain yet.
  const start = (candidate: Candidate) =>
    run(async () => {
      setStatus("Create a passkey on this device…");
      const passkey = await createWalletPasskey(userId, userId);
      const newKey = createStarkOwnerKey(passkey.encryptKey);
      const recoveryKey = candidate.path === "guardian" ? createStarkOwnerKey(passkey.encryptKey) : null;
      await api("POST", {
        action: "start",
        path: candidate.path,
        signerAddress: candidate.record.signerAddress,
        newPubkey: newKey.publicKey,
        newKeyEnc: newKey.encryptedPrivateKey,
        recoveryPubkey: recoveryKey?.publicKey,
        recoveryKeyEnc: recoveryKey?.encryptedPrivateKey,
        credentialId: passkey.credentialId,
        prfSupported: passkey.prfSupported,
      });
    });

  // 2. The trusted wallet approves: initiate the recovery (guardian) or propose the rotation (co-owner).
  const approve = (discovered: DiscoveredWallet, recovery: RecoveryRecord) =>
    run(async () => {
      if (recovery.path === "guardian") {
        const txHash = await approveWith(discovered, recovery, [
          buildInitiateRecoveryCall({ walletAddress, proposer: recovery.signerOwnerId, newOwner: recoveryNewOwner(recovery.recoveryPubkey!) }),
        ]);
        setStatus("Sent. Waiting for Starknet…");
        await api("PATCH", { action: "initiated", txHash });
      } else {
        const txHash = await approveWith(discovered, recovery, [
          buildProposeRotateOwnerCall({
            walletAddress,
            proposer: recovery.signerOwnerId,
            ownerId: PASSKEY_OWNER_ID,
            newPubkeyBytes: starkPubkeyFelts(recovery.newPubkey),
          }),
        ]);
        setStatus("Sent. Waiting for Starknet…");
        await api("PATCH", { action: "proposed", txHash });
      }
    });

  // 3. After 7 days: finalize (the server, gasless), then R proposes moving owner 0 to K and removing itself.
  const finishRecovery = (recovery: RecoveryRecord, step: RecoveryStep) =>
    run(async () => {
      let ownerId = recovery.recoveredOwnerId;
      if (step.kind === "finalize") {
        setStatus("Finishing the recovery…");
        ownerId = (await api<{ recoveredOwnerId: number }>("POST", { action: "finalize" })).recoveredOwnerId;
      }
      if (ownerId === null) throw new Error("The recovered key isn't on your wallet yet. Reload.");
      const privateKey = await unlock(recovery.recoveryKeyEnc, recovery.credentialId);
      setStatus("Sending…");
      const txHash = await starkKeyExecute({
        params: {
          walletAddress,
          privateKey,
          ownerIndex: ownerId,
          calls: [
            buildProposeRotateOwnerCall({
              walletAddress,
              proposer: ownerId,
              ownerId: PASSKEY_OWNER_ID,
              newPubkeyBytes: starkPubkeyFelts(recovery.newPubkey),
            }),
            buildProposeRemoveOwnerCall({ walletAddress, proposer: ownerId, ownerId }),
          ],
        },
        bearerToken: await bearer(),
      });
      setStatus("Sent. Waiting for Starknet…");
      await api("PATCH", { action: "proposed", txHash });
    });

  // 4. After 24 hours: execute the rotation (and R's removal). The server then stores K with the new passkey.
  const activate = (recovery: RecoveryRecord, discovered?: DiscoveredWallet) =>
    run(async () => {
      const rotate = buildExecuteRotateOwnerCall({
        walletAddress,
        opId: recovery.rotateOpId!,
        ownerId: PASSKEY_OWNER_ID,
        newPubkeyBytes: starkPubkeyFelts(recovery.newPubkey),
      });
      let txHash: string;
      if (recovery.path === "guardian") {
        const ownerId = recovery.recoveredOwnerId!;
        const privateKey = await unlock(recovery.recoveryKeyEnc, recovery.credentialId);
        setStatus("Sending…");
        txHash = await starkKeyExecute({
          params: {
            walletAddress,
            privateKey,
            ownerIndex: ownerId,
            calls: [rotate, buildExecuteRemoveOwnerCall({ walletAddress, opId: recovery.removeOpId!, ownerId })],
          },
          bearerToken: await bearer(),
        });
      } else {
        if (!discovered) throw new Error("Pick your co-owner wallet.");
        txHash = await approveWith(discovered, recovery, [rotate]);
      }
      setStatus("Sent. Waiting for Starknet…");
      await api("PATCH", { action: "executed", txHash });
    });

  const store = () =>
    run(async () => {
      setStatus("Saving your new key…");
      await api("PATCH", { action: "executed" });
    });

  const startOver = () =>
    run(async () => {
      await api("DELETE");
    });

  const addSignInPasskey = () =>
    run(async () => {
      setStatus("Create a sign-in passkey…");
      const result = await authClient.passkey.addPasskey({ name: "Vela" });
      if (result?.error) throw new Error(result.error.message ?? "Couldn't add the passkey.");
      setStatus("Done: this device's passkey signs you in to Vela.");
    });

  if (!state || !candidates) return <p className="text-sm text-[var(--text-muted)]">{error ?? "Reading your wallet…"}</p>;

  const { recovery, step } = state;
  const walletPicker = (onPick: (w: DiscoveredWallet) => void, label: string) =>
    wallets.length === 0 ? (
      <p className="text-sm text-[var(--text-secondary)]">Open this page in a browser with your trusted wallet (Bramble) installed.</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {wallets.map((w) => (
          <button
            key={w.name}
            onClick={() => onPick(w)}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium disabled:opacity-50"
          >
            {label} {w.name}
          </button>
        ))}
      </div>
    );

  let body: React.ReactNode;
  if (!recovery || !step || step.kind === "cancelled" || step.kind === "unknown") {
    body = (
      <div className="space-y-4">
        {step?.kind === "cancelled" && <p className="text-sm text-[var(--vela-gold)]">Your last recovery was cancelled by an owner of the wallet.</p>}
        {step?.kind === "unknown" && <p className="text-sm text-[var(--vela-gold)]">Your wallet changed in a way this recovery can&apos;t continue from.</p>}
        {candidates.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            This wallet has no active recovery wallet or co-owner, so it can&apos;t be recovered. If you still have your passkey,
            add one from the dashboard.
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--text-secondary)]">
              You&apos;ll make a new passkey on this device, and your trusted wallet approves. With a recovery wallet it takes 7
              days, then 1 more; with a co-owner, 1 day. During that time your old passkey can cancel it, so a stranger can&apos;t
              take your wallet quietly.
            </p>
            {candidates.map((c) => (
              <button
                key={c.record.signerAddress}
                onClick={() => start(c)}
                disabled={busy}
                className="block w-full text-left glass p-4 disabled:opacity-50"
              >
                <span className="font-medium">
                  Recover with {c.record.walletName} {short(c.record.signerAddress)}
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {TRUSTED_ROLES[c.record.role].name} · {c.path === "guardian" ? "about 8 days" : "about 1 day"} · creates a new passkey here
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    );
  } else if (step.kind === "approve") {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">
          {recovery.path === "guardian"
            ? "Approve the recovery in your recovery wallet. It signs one thing: adding your new key after 7 days."
            : "Approve moving your wallet to the new passkey in your co-owner wallet. It takes effect after 24 hours."}{" "}
          Use the account {short(recovery.signerAddress)}.
        </p>
        {walletPicker((w) => approve(w, recovery), "Approve with")}
        <button onClick={startOver} disabled={busy} className="block text-xs text-[var(--text-muted)] hover:underline">
          Start over
        </button>
      </div>
    );
  } else if (step.kind === "waiting-recovery") {
    body = (
      <p className="text-sm text-[var(--text-secondary)]">
        Recovery started. Come back after {formatDate(step.readyAt)} ({formatWait(Math.max(0, step.readyAt - now))} left) to finish
        it on this device. Your dashboard shows it as a pending recovery: that&apos;s this one.
      </p>
    );
  } else if (step.kind === "finalize" || step.kind === "propose") {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">
          The 7 days are over. Finish the recovery: your new passkey moves your wallet to its new key. That takes 24 more hours.
        </p>
        <button
          onClick={() => finishRecovery(recovery, step)}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium disabled:opacity-50"
        >
          Finish the recovery
        </button>
      </div>
    );
  } else if (step.kind === "waiting-rotation") {
    body = (
      <p className="text-sm text-[var(--text-secondary)]">
        Almost there. Come back after {formatDate(step.readyAt)} ({formatWait(Math.max(0, step.readyAt - now))} left) to activate
        your new passkey.
      </p>
    );
  } else if (step.kind === "activate") {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">
          Activate your new passkey (before {formatDate(step.expiresAt)}). Your old passkey stops working.
        </p>
        {recovery.path === "guardian" ? (
          <button
            onClick={() => activate(recovery)}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium disabled:opacity-50"
          >
            Activate with your new passkey
          </button>
        ) : (
          walletPicker((w) => activate(recovery, w), "Activate with")
        )}
      </div>
    );
  } else if (step.kind === "store") {
    body = (
      <button
        onClick={store}
        disabled={busy}
        className="px-4 py-2 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium disabled:opacity-50"
      >
        Save your new key
      </button>
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-[var(--vela-green)]">Recovered. Your wallet opens with this device&apos;s passkey.</p>
        <button onClick={addSignInPasskey} disabled={busy} className="block text-sm text-[var(--vela-blue)] hover:underline">
          Also sign in to Vela with this passkey
        </button>
        <Link href="/dashboard" className="block text-sm text-[var(--vela-blue)] hover:underline">
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {body}
      {status && <p className="text-sm text-[var(--vela-blue)]">{status}</p>}
      {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
    </div>
  );
}
