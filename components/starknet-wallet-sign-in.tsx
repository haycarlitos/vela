"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  connectWallet,
  deploymentData,
  listWallets,
  signTypedData,
  subscribeWallets,
  walletErrorMessage,
  type ConnectedWallet,
  type DiscoveredWallet,
} from "@/lib/starknet-wallet";

type Issued = { nonce: string; typedData: unknown };

interface Props {
  /** "signin" signs in or creates the account; "link" adds the wallet to the signed-in account. */
  mode: "signin" | "link";
  onDone: (result: { address: string; created: boolean }) => void;
  onCancel?: () => void;
}

/**
 * Sign in with Starknet. Two clicks on purpose: the first connects the wallet,
 * the second sends the signature request. Each wallet request then starts from
 * a click, which some wallets (Bramble's side panel) need to open their UI.
 */
export function StarknetWalletSignIn({ mode, onDone, onCancel }: Props) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setWallets(listWallets());
    refresh();
    const unsubscribe = subscribeWallets(refresh);
    // Extensions can inject a moment after the page loads.
    const timer = setTimeout(refresh, 800);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const connect = async (wallet: DiscoveredWallet) => {
    setBusy(true);
    setError(null);
    try {
      const account = await connectWallet(wallet);
      const { data, error: fetchError } = await authClient.$fetch<Issued>("/starknet/nonce", {
        method: "POST",
        body: { address: account.address },
      });
      if (fetchError || !data) throw new Error(fetchError?.message ?? "Could not start the sign-in");
      setConnected(account);
      setIssued(data);
    } catch (err) {
      setError(walletErrorMessage(err, wallet.name));
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (!connected || !issued) return;
    setBusy(true);
    setError(null);
    try {
      const deployment = await deploymentData(connected);
      const signature = await signTypedData(connected, issued.typedData);
      const { data, error: verifyError } = await authClient.$fetch<{ address: string; created: boolean }>(
        "/starknet/verify",
        { method: "POST", body: { nonce: issued.nonce, signature, ...(deployment ? { deploymentData: deployment } : {}) } }
      );
      if (verifyError || !data) {
        // The nonce is spent either way: start over with a fresh one.
        setIssued(null);
        setConnected(null);
        throw new Error(verifyError?.message ?? "The signature didn't check out");
      }
      // The server set the session cookie: tell useSession to refetch.
      authClient.$store.notify("$sessionSignal");
      onDone(data);
    } catch (err) {
      setError(walletErrorMessage(err, connected.name));
    } finally {
      setBusy(false);
    }
  };

  if (connected && issued) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">
          Connected <span className="font-mono">{short(connected.address)}</span>. Approve the sign-in message in {connected.name}.
          It costs nothing and moves no funds.
        </p>
        <button
          onClick={sign}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
        >
          {busy ? `Waiting for ${connected.name}…` : `Sign in with ${connected.name}`}
        </button>
        {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {wallets.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">
          No Starknet wallet found in this browser. Install Bramble, Braavos or Ready, then reload.
        </p>
      )}
      {wallets.map((w) => (
        <button
          key={w.name}
          onClick={() => connect(w)}
          disabled={busy}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass hover:brightness-110 transition-all disabled:opacity-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs */}
          <img src={w.icon} alt="" width={24} height={24} className="rounded" />
          <span className="font-medium">{w.name}</span>
        </button>
      ))}
      {mode === "signin" && (
        <p className="text-xs text-[var(--text-muted)] pt-1">
          Your wallet signs a message to prove it&apos;s yours. Vela never gets its keys.
        </p>
      )}
      {onCancel && (
        <button onClick={onCancel} disabled={busy} className="text-sm text-[var(--vela-blue)] hover:underline disabled:opacity-50">
          Back
        </button>
      )}
      {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
    </div>
  );
}

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
