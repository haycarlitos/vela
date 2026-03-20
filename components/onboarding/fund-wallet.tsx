"use client";

import { useState, useEffect } from "react";
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

  const checkBalance = async () => {
    setPolling(true);
    try {
      // In production: getTokenBalance(USDC_ADDRESS, walletAddress)
      // For demo, simulate balance check
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
  };

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(checkBalance, 10000);
    return () => clearInterval(interval);
  });

  const shortAddress = `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 max-w-md mx-auto text-center"
    >
      <h2 className="text-2xl font-bold mb-4">Fund Your Wallet</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Send USDC to your wallet to get started. Minimum $10 USDC.
      </p>

      <div className="glass p-4 mb-4">
        <p className="text-xs text-[var(--text-muted)] mb-1">Your address</p>
        <div className="flex items-center justify-center gap-2">
          <code className="font-mono text-sm">{shortAddress}</code>
          <button
            onClick={copyAddress}
            className="text-xs text-[var(--vela-blue)] hover:underline"
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
          <p className="text-sm text-[var(--vela-green)] mt-1">Balance detected!</p>
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
