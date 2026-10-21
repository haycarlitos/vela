"use client";

import { useCallback, useEffect, useState } from "react";
import { buildCancelRecoveryCall, readPendingRecovery } from "@chipi-stack/backend";
import type { ChipiWalletData } from "@chipi-stack/nextjs";
import { formatDate, recoveryAlert, type RecoveryAlert as Alert } from "@/lib/notices";
import { starknetProvider } from "@/lib/starknet-wallet";
import { PASSKEY_OWNER_ID, formatWait } from "@/lib/trusted-wallets";
import { usePasskeyCalls } from "@/lib/use-passkey-calls";

/** How often to look for a recovery while the dashboard is open. */
const POLL_MS = 60_000;

/**
 * A recovery wallet can start a recovery that adds a new key to the Vela
 * wallet after 7 days. If the user didn't start it, those 7 days are theirs to
 * cancel it: this banner says so the moment the chain shows one, and cancels
 * it with one passkey prompt.
 */
export function RecoveryAlert({ wallet }: { wallet: ChipiWalletData | null }) {
  const walletAddress = wallet?.publicKey ?? null;
  const signWithPasskey = usePasskeyCalls(wallet);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async () => {
    if (!walletAddress) return null;
    const at = Math.floor(Date.now() / 1000);
    return { alert: recoveryAlert(await readPendingRecovery(starknetProvider, walletAddress), at), at };
  }, [walletAddress]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      read()
        .then((next) => {
          if (cancelled || !next) return;
          setAlert(next.alert);
          setNow(next.at);
        })
        // A failed read keeps what was last shown; the next poll tries again.
        .catch((err: unknown) => console.warn("recovery check failed", err));
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [read]);

  if (!alert) return status ? <p className="glass p-4 text-sm text-[var(--vela-green)]">{status}</p> : null;

  const cancel = async () => {
    if (!walletAddress) return;
    setBusy(true);
    setError(null);
    try {
      // The passkey is owner 0, a ROLE_OWNER: it may cancel any recovery.
      await signWithPasskey([buildCancelRecoveryCall({ walletAddress, ownerId: PASSKEY_OWNER_ID })], setStatus);
      const next = await read();
      setAlert(next?.alert ?? null);
      setStatus(next?.alert ? null : "Recovery cancelled. Your wallet's keys are unchanged.");
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="alert" className="glass p-6 space-y-3 border border-[var(--vela-red)]">
      <p className="font-semibold text-[var(--vela-red)]">Someone started a recovery of your wallet</p>
      <p className="text-sm text-[var(--text-secondary)]">
        On {formatDate(alert.initiatedAt)}, a recovery wallet asked to add a new key to your Vela wallet.{" "}
        {alert.ready ? (
          <>The 7-day wait is over: anyone can complete it now, and that key would control your funds.</>
        ) : (
          <>
            It can be completed on {formatDate(alert.completesAt)} ({formatWait(alert.completesAt - now)} left). Then that
            key would control your funds.
          </>
        )}
      </p>
      <p className="text-sm text-[var(--text-secondary)]">
        If you didn&apos;t start it, cancel it now. If you did (you lost your passkey), ignore this.
      </p>
      <button
        onClick={cancel}
        disabled={busy}
        className="px-4 py-2 rounded-lg bg-[var(--vela-red)] text-white font-medium disabled:opacity-50"
      >
        {busy ? "Cancelling…" : "Cancel recovery"}
      </button>
      {status && <p className="text-sm text-[var(--vela-blue)]">{status}</p>}
      {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
    </div>
  );
}
