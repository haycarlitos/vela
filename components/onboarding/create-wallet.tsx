"use client";

import { useState } from "react";
import { useCreateWallet, Chain } from "@chipi-stack/nextjs";
import { motion } from "framer-motion";

interface CreateWalletProps {
  externalUserId: string;
  onWalletCreated: (walletAddress: string, pin: string) => void;
}

export function CreateWallet({ externalUserId, onWalletCreated }: CreateWalletProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { createWalletAsync, isLoading } = useCreateWallet();

  const handleCreate = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    setError(null);

    try {
      const result = await createWalletAsync({
        params: {
          encryptKey: pin,
          externalUserId,
          chain: Chain.STARKNET,
          walletType: "CHIPI",
        },
        bearerToken: process.env.NEXT_PUBLIC_CHIPI_API_KEY!,
      });

      onWalletCreated(result.publicKey, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 max-w-md mx-auto text-center"
    >
      <h2 className="text-2xl font-bold mb-2">Create Your Wallet</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Set a 4-digit PIN to secure your Starknet wallet.
      </p>

      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="Enter PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        className="w-full glass p-3 bg-transparent outline-none text-center text-2xl font-mono tracking-[0.5em] mb-6 focus:border-[var(--vela-blue)]"
      />

      <button
        onClick={handleCreate}
        disabled={isLoading || pin.length < 4}
        className="w-full py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
      >
        {isLoading ? "Creating wallet..." : "Create Wallet"}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--vela-red)]">{error}</p>}
    </motion.div>
  );
}
