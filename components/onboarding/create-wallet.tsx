"use client";

import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Chain, createWalletPasskey, PrfUnsupportedError, useCreateWallet } from "@chipi-stack/nextjs";
import { motion } from "framer-motion";

interface CreateWalletProps {
  userId: string;
  onCreated: () => void;
}

/**
 * A self-custodial SHHH wallet. Its key is encrypted with the passkey's PRF
 * secret, so neither Chipi nor Vela can decrypt it.
 */
export function CreateWallet({ userId, onCreated }: CreateWalletProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { createWalletAsync, isLoading } = useCreateWallet();
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    try {
      // Face ID / fingerprint. Requires WebAuthn PRF: without it the wallet
      // would be custodial, so the SDK throws PrfUnsupportedError instead.
      const name = user?.primaryEmailAddress?.emailAddress ?? userId;
      const { encryptKey } = await createWalletPasskey(userId, name);

      // Token after the prompt: one fetched before it can expire on the biometric sheet.
      const bearerToken = await getToken({ skipCache: true });
      if (!bearerToken) throw new Error("Your session expired. Sign in again.");

      await createWalletAsync({
        params: { encryptKey, externalUserId: userId, chain: Chain.STARKNET, walletType: "SHHH" },
        bearerToken,
      });
      onCreated();
    } catch (err) {
      if (err instanceof PrfUnsupportedError) {
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
