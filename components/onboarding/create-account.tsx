"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { authClient } from "@/lib/auth-client";

/**
 * Your Vela account is a passkey: no email, no password. Signing up creates
 * an account and registers a passkey for it right away; signing in is that
 * passkey again.
 */
export function CreateAccount() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {error && <p className="mt-3 text-sm text-[var(--vela-red)]">{error}</p>}
    </motion.div>
  );
}
