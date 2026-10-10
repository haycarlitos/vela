"use client";

import { useState } from "react";
import { ChainToken, getWalletEncryptKey, useTransfer } from "@chipi-stack/nextjs";
import type { ChipiWalletData } from "@chipi-stack/nextjs";
import { getChipiToken } from "@/lib/auth-client";
import { waitForTx } from "@/lib/starknet-wallet";
import { checkWithdrawal, formatUsdc, usdToUsdcUnits } from "@/lib/wallet-amounts";
import { StarknetWalletSignIn } from "@/components/starknet-wallet-sign-in";

interface Props {
  /** The user's own Starknet wallet, or null if none is linked yet. */
  linkedWallet: string | null;
  /** The Vela (Chipi) wallet, from useChipiWallet. */
  wallet: ChipiWalletData | null;
  /** USDC sitting in the Vela wallet (not in Vesu), in tokens. */
  liquidUsdc: number;
  onChanged: () => void;
}

/**
 * The user's own wallet: link it once (Sign in with Starknet), then withdraw
 * USDC to it. Withdrawals are signed in this browser with the passkey (the
 * owner key never leaves it) and only go to the linked address.
 */
export function LinkedWallet({ linkedWallet, wallet, liquidUsdc, onChanged }: Props) {
  const { transferAsync } = useTransfer();
  const [linking, setLinking] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liquidUnits = usdToUsdcUnits(liquidUsdc);

  const withdraw = async () => {
    if (!linkedWallet || !wallet) return;
    const check = checkWithdrawal(amount, { liquidUsdc: liquidUnits });
    if (!check.ok) return setError(check.message);
    setBusy(true);
    setError(null);
    setStatus("Confirm with your passkey…");
    try {
      const encryptKey = await getWalletEncryptKey(wallet.credentialId ?? undefined, {
        prfSupported: wallet.prfSupported ?? undefined,
      });
      if (!encryptKey) throw new Error("Passkey confirmation was cancelled.");
      const bearerToken = await getChipiToken();
      if (!bearerToken) throw new Error("Your session expired. Sign in again.");
      const txHash = await transferAsync({
        params: {
          encryptKey,
          wallet,
          token: ChainToken.USDC,
          recipient: linkedWallet,
          amount: Number(formatUsdc(check.units)),
        },
        bearerToken,
      });
      setStatus("Sent. Waiting for Starknet…");
      await waitForTx(txHash);
      setStatus(`Withdrew ${formatUsdc(check.units)} USDC to your wallet.`);
      setAmount("");
      onChanged();
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass p-6 space-y-3">
      <h3 className="font-semibold">Your wallet</h3>
      {!linkedWallet && !linking && (
        <>
          <p className="text-sm text-[var(--text-secondary)]">
            Link the Starknet wallet you already use (Bramble, Braavos, Ready) to withdraw to it.
          </p>
          <button onClick={() => setLinking(true)} className="text-sm text-[var(--vela-blue)] hover:underline">
            Link a wallet
          </button>
        </>
      )}
      {!linkedWallet && linking && (
        <StarknetWalletSignIn
          mode="link"
          onDone={() => {
            setLinking(false);
            onChanged();
          }}
          onCancel={() => setLinking(false)}
        />
      )}
      {linkedWallet && (
        <>
          <p className="text-sm text-[var(--text-secondary)]">
            Withdrawals go to <span className="font-mono">{linkedWallet.slice(0, 8)}…{linkedWallet.slice(-6)}</span>. Up to{" "}
            {formatUsdc(liquidUnits)} USDC is available now; funds in Vesu come back when the agent withdraws or you stop it.
          </p>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              placeholder="Amount in USDC"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-xl glass bg-transparent outline-none font-mono"
            />
            <button
              onClick={withdraw}
              disabled={busy || !amount || !wallet}
              className="px-4 py-2 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
            >
              {busy ? "Withdrawing…" : "Withdraw"}
            </button>
          </div>
        </>
      )}
      {status && <p className="text-sm text-[var(--text-secondary)]">{status}</p>}
      {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
    </div>
  );
}
