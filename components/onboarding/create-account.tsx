"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { StarknetWalletSignIn } from "@/components/starknet-wallet-sign-in";

/**
 * Your Vela account is a passkey or your Starknet wallet: no email, no
 * password. Signing up with a passkey creates an account and registers the
 * passkey right away; signing in is that passkey again. With a wallet
 * (Bramble, Braavos, Ready), the wallet signs a message instead and stays
 * linked as the place withdrawals go.
 */
export function CreateAccount() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withWallet, setWithWallet] = useState(false);

  const run = (action: () => Promise<void>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const signUp = run(async () => {
    const account = await authClient.signIn.anonymous();
    if (account.error) throw new Error(account.error.message ?? "Could not create your account");
    const added = await authClient.passkey.addPasskey({ name: "Vela" });
    if (added?.error) {
      // An account without a passkey could never sign in again.
      await authClient.signOut();
      throw new Error(added.error.message ?? "The passkey was not created");
    }
  });

  const signIn = run(async () => {
    const result = await authClient.signIn.passkey();
    if (result?.error) throw new Error(result.error.message ?? "Sign-in failed");
  });

  if (withWallet) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-8 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-2 text-center">Continue with your wallet</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6 text-center">
          Use the Starknet wallet you already have. It stays yours: the agent gets its own wallet with limits, and
          withdrawals come back here.
        </p>
        {/* The session cookie is set by the server; onboarding moves on when the session appears. */}
        <StarknetWalletSignIn mode="signin" onDone={() => {}} onCancel={() => setWithWallet(false)} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 max-w-md mx-auto text-center"
    >
      <h2 className="text-2xl font-bold mb-2">Create your account</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        A passkey (Face ID or fingerprint) is your account. No email, no password.
      </p>

      <button
        onClick={signUp}
        disabled={busy}
        className="w-full py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
      >
        {busy ? "Waiting for your passkey…" : "Create account with passkey"}
      </button>
      <button onClick={signIn} disabled={busy} className="mt-3 text-sm text-[var(--vela-blue)] hover:underline disabled:opacity-50">
        I already have an account
      </button>
      <div className="mt-6 pt-6 border-t border-[var(--glass-border)]">
        <button
          onClick={() => setWithWallet(true)}
          disabled={busy}
          className="w-full py-3 rounded-xl glass font-medium hover:brightness-110 transition-all disabled:opacity-50"
        >
          Continue with Bramble, Braavos or Ready
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--vela-red)]">{error}</p>}
    </motion.div>
  );
}
