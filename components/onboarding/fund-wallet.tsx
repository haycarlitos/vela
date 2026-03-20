"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface FundWalletProps {
  walletAddress: string;
  onFunded: (balance: number) => void;
}

export function FundWallet({ walletAddress, onFunded }: FundWalletProps) {
  const [balance, setBalance] = useState(0);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkBalance = useCallback(async () => {
    setPolling(true);
    try {
      const res = await fetch(`/api/agent/status?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        const usdcBalance = data.portfolio?.usdc?.usd ?? 0;
        setBalance(usdcBalance);
        if (usdcBalance >= 10) {
          onFunded(usdcBalance);
        }
      }
    } catch {
      // Ignore polling errors
    } finally {
      setPolling(false);
    }
  }, [walletAddress, onFunded]);

  // Poll every 15 seconds
  useEffect(() => {
    checkBalance();
    const interval = setInterval(checkBalance, 15000);
    return () => clearInterval(interval);
  }, [checkBalance]);

  const shortAddress = `${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 max-w-md mx-auto text-center"
    >
      <h2 className="text-2xl font-bold mb-2">Fund Your Wallet</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Send at least $10 USDC (Starknet) to your wallet address.
      </p>

      <div className="glass p-4 mb-4">
        <p className="text-xs text-[var(--text-muted)] mb-2">Your Starknet address</p>
        <div className="flex items-center justify-center gap-2">
          <code className="font-mono text-sm break-all">{shortAddress}</code>
          <button
            onClick={copyAddress}
            className="text-xs text-[var(--vela-blue)] hover:underline shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-sm text-[var(--text-secondary)]">
          Current balance:{" "}
          <span className={`font-mono font-bold ${balance >= 10 ? "text-[var(--vela-green)]" : ""}`}>
            ${balance.toFixed(2)} USDC
          </span>
        </p>
        {balance >= 10 && (
          <p className="text-sm text-[var(--vela-green)] mt-1">Balance detected! Continuing...</p>
        )}
        {balance > 0 && balance < 10 && (
          <p className="text-xs text-[var(--vela-gold)] mt-1">Minimum $10 needed. Send more USDC.</p>
        )}
      </div>

      <button
        onClick={checkBalance}
        disabled={polling}
        className="w-full py-3 rounded-xl glass font-medium hover:bg-[var(--glass-hover)] transition-all disabled:opacity-50"
      >
        {polling ? "Checking..." : "Refresh Balance"}
      </button>
    </motion.div>
  );
}
