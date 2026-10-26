"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MIN_FUNDING_USD } from "@/lib/config";
import { SendFromWallet } from "@/components/send-from-wallet";
import { FundFromEvm } from "@/components/fund-from-evm";

interface FundWalletProps {
  walletAddress: string;
  usdc: number;
  depositCapUsd: number;
  onRefresh: () => void;
}

export function FundWallet({ walletAddress, usdc, depositCapUsd, onRefresh }: FundWalletProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    void navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = `${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 max-w-md mx-auto text-center"
    >
      <h2 className="text-2xl font-bold mb-2">Fund your wallet</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Send at least ${MIN_FUNDING_USD} of USDC on Starknet. The agent manages up to ${depositCapUsd}.
      </p>

      <div className="mb-6">
        <SendFromWallet to={walletAddress} roomUsd={Math.max(0, depositCapUsd - usdc)} onSent={onRefresh} />
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-2">Or bring USDC you hold on Base (Circle CCTP, course module 20)</p>
      <div className="mb-6">
        <FundFromEvm to={walletAddress} roomUsd={Math.max(0, depositCapUsd - usdc)} onDeposited={onRefresh} />
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-2">Or send USDC on Starknet to this address</p>
      <div className="glass p-4 mb-4">
        <p className="text-xs text-[var(--text-muted)] mb-2">Your Vela wallet</p>
        <div className="flex items-center justify-center gap-2">
          <code className="font-mono text-sm break-all">{shortAddress}</code>
          <button onClick={copyAddress} className="text-xs text-[var(--vela-blue)] hover:underline shrink-0">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Current balance: <span className="font-mono font-bold">${usdc.toFixed(2)} USDC</span>
      </p>

      <button
        onClick={onRefresh}
        className="w-full py-3 rounded-xl glass font-medium hover:bg-[var(--glass-hover)] transition-all"
      >
        Refresh balance
      </button>
    </motion.div>
  );
}
