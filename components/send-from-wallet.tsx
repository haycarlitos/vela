"use client";

import { useEffect, useState } from "react";
import {
  MIN_STRK_FOR_FEES,
  connectWallet,
  externalBalances,
  listWallets,
  sendUsdc,
  subscribeWallets,
  walletErrorMessage,
  type ConnectedWallet,
  type DiscoveredWallet,
} from "@/lib/starknet-wallet";
import { checkDeposit, formatUsdc } from "@/lib/wallet-amounts";

interface Props {
  /** The Vela wallet that receives the USDC. */
  to: string;
  /** Room left under the beta deposit cap, in dollars. */
  roomUsd: number;
  onSent: () => void;
}

/**
 * Funds the Vela wallet from the user's existing wallet: one USDC transfer the
 * wallet shows and signs. The wallet pays its own network fee in STRK (Bramble
 * has no paymaster for dApp transactions; a new account's first transaction
 * also deploys it), so we check for STRK before asking.
 */
export function SendFromWallet({ to, roomUsd, onSent }: Props) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);
  const [balances, setBalances] = useState<{ usdc: bigint; strk: bigint } | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setWallets(listWallets());
    refresh();
    const unsubscribe = subscribeWallets(refresh);
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
      setConnected(account);
      setBalances(await externalBalances(account.address));
    } catch (err) {
      setError(walletErrorMessage(err, wallet.name));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!connected || !balances) return;
    const check = checkDeposit(amount, { walletUsdc: balances.usdc, roomUsd });
    if (!check.ok) return setError(check.message);
    setBusy(true);
    setError(null);
    setStatus(`Approve the transfer in ${connected.name}…`);
    try {
      await sendUsdc(connected, to, check.units);
      setStatus(`Sent ${formatUsdc(check.units)} USDC.`);
      setAmount("");
      setBalances(await externalBalances(connected.address));
      onSent();
    } catch (err) {
      setStatus(null);
      setError(walletErrorMessage(err, connected.name));
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="space-y-2">
        {wallets.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">No Starknet wallet found in this browser. Copy the address instead.</p>
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
            <span className="font-medium">Send USDC from {w.name}</span>
          </button>
        ))}
        {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
      </div>
    );
  }

  const lowStrk = balances !== null && balances.strk < MIN_STRK_FOR_FEES;
  return (
    <div className="space-y-3 text-left">
      <p className="text-sm text-[var(--text-secondary)]">
        {connected.name} has <span className="font-mono">{balances ? formatUsdc(balances.usdc) : "…"} USDC</span>
        {" "}in its public balance.
      </p>
      {lowStrk && (
        <p className="text-sm text-[var(--vela-gold)]">
          {connected.name} pays the network fee in STRK and has almost none. Add a little STRK (0.1 is plenty) and try
          again.
        </p>
      )}
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          placeholder="Amount in USDC"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          className="flex-1 px-4 py-3 rounded-xl glass bg-transparent outline-none font-mono"
        />
        <button
          onClick={send}
          disabled={busy || !amount}
          className="px-5 py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {status && <p className="text-sm text-[var(--text-secondary)]">{status}</p>}
      {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
    </div>
  );
}
