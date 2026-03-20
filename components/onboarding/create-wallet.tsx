"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface CreateWalletProps {
  onWalletCreated: (walletAddress: string) => void;
}

export function CreateWallet({ onWalletCreated }: CreateWalletProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      // In production, this uses the Chipi SDK:
      // const wallet = await createWallet({ externalUserId, encryptKey: passkeyDerivedPin });
      // For demo, simulate wallet creation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const demoAddress = "0x01a2b3c4d5e6f7890123456789abcdef01234567890123456789abcdef012345";
      onWalletCreated(demoAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 max-w-md mx-auto text-center"
    >
      <h2 className="text-2xl font-bold mb-4">Create Your Wallet</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        We&apos;ll create a secure Starknet wallet protected by your fingerprint or Face ID.
      </p>
      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Wallet"}
      </button>
      {error && <p className="mt-3 text-sm text-[var(--vela-red)]">{error}</p>}
    </motion.div>
  );
}
