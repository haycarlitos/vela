"use client";

import { useState } from "react";
import { Chain, useCreateWallet } from "@chipi-stack/nextjs";
import { motion } from "framer-motion";
import { getChipiToken } from "@/lib/auth-client";

interface CreateWalletProps {
  userId: string;
  /** Set when the user signed in with their own Starknet wallet. */
  linkedWallet?: string | null;
  onCreated: () => void;
}

/**
 * A self-custodial SHHH wallet. Its key is encrypted with the passkey's PRF
 * secret, so neither Chipi nor Vela can decrypt it.
 */
export function CreateWallet({ userId, linkedWallet, onCreated }: CreateWalletProps) {
  const { createWalletAsync, isLoading } = useCreateWallet();
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    try {
      const bearerToken = await getChipiToken();
      if (!bearerToken) throw new Error("Your session expired. Sign in again.");

      // Face ID / fingerprint: a passkey for this wallet. Chipi stores its
      // credential id, so any device with the passkey can open the wallet.
      // Requires WebAuthn PRF: without it the wallet would be custodial, so
      // the SDK refuses (PRF_UNSUPPORTED) instead.
      await createWalletAsync({
        params: { externalUserId: userId, chain: Chain.STARKNET, walletType: "SHHH", usePasskey: true },
        bearerToken,
      });
      onCreated();
    } catch (err) {
      if ((err as { code?: string }).code === "PRF_UNSUPPORTED") {
        setError(
          "This device can't secure a wallet. Use a recent iPhone or Android, or a password manager with passkeys."
        );
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 max-w-md mx-auto text-center"
    >
      <h2 className="text-2xl font-bold mb-2">Create your wallet</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Secured by your passkey (Face ID or fingerprint). Only you can move your money.
      </p>
      {linkedWallet && (
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          This is the agent&apos;s wallet, with spending limits your own wallet can&apos;t set. Your wallet stays yours, and
          withdrawals go back to it.
        </p>
      )}

      <button
        onClick={handleCreate}
        disabled={isLoading}
        className="w-full py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
      >
        {isLoading ? "Creating wallet…" : "Create wallet with passkey"}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--vela-red)]">{error}</p>}
    </motion.div>
  );
}
