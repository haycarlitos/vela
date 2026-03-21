"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PnlChart } from "@/components/dashboard/pnl-chart";
import { StopAgent } from "@/components/dashboard/stop-agent";
import { PortfolioCard } from "@/components/dashboard/portfolio-card";
import { OceanBackground } from "@/components/ocean-background";
import { ThemeToggle } from "@/components/theme-toggle";

interface StatusData {
  portfolio: {
    totalValueUsd: number;
    usdc: { balance: number; usd: number };
    eth: { balance: number; usd: number; price: number };
    strk: { balance: number; usd: number; price: number };
    vesuDeposited: number;
    vesuApy: number;
  };
  decisions: {
    id: number;
    createdAt: string;
    action: string;
    pair: string | null;
    amountUsd: number | null;
    reasoning: string | null;
    txHash: string | null;
    outcome: string;
  }[];
  snapshots: {
    createdAt: string;
    totalValueUsd: number;
    pnlUsd: number;
    pnlPct: number;
  }[];
  stats: {
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalDecisions: number;
    totalX402Spent: number;
  };
  pnl: { usd: number; pct: number };
}

// Demo data for when no wallet is connected
const DEMO_DATA: StatusData = {
  portfolio: {
    totalValueUsd: 10.21,
    usdc: { balance: 4.2, usd: 4.2 },
    eth: { balance: 0.00083, usd: 2.05, price: 2469.88 },
    strk: { balance: 2.38, usd: 0.95, price: 0.399 },
    vesuDeposited: 3.01,
    vesuApy: 6.2,
  },
  decisions: [
    { id: 1, createdAt: new Date(Date.now() - 30 * 60000).toISOString(), action: "hold", pair: null, amountUsd: null, reasoning: "Market is quiet. Protecting your balance until a better opportunity shows up.", txHash: null, outcome: "open" },
    { id: 2, createdAt: new Date(Date.now() - 60 * 60000).toISOString(), action: "swap", pair: "USDC\u2192ETH", amountUsd: 2.0, reasoning: "ETH dropped 6.2% in the last 2 hours. Bought the dip for you.", txHash: "0x04a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1", outcome: "profit" },
    { id: 3, createdAt: new Date(Date.now() - 90 * 60000).toISOString(), action: "hold", pair: null, amountUsd: null, reasoning: "Trade fees are too high right now. Waiting for a better price.", txHash: null, outcome: "open" },
    { id: 4, createdAt: new Date(Date.now() - 120 * 60000).toISOString(), action: "supply_vesu", pair: null, amountUsd: 3.0, reasoning: "Your idle USDC is now earning 6.2% annual yield. Money working for you.", txHash: "0x05b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2", outcome: "open" },
    { id: 5, createdAt: new Date(Date.now() - 150 * 60000).toISOString(), action: "swap", pair: "USDC\u2192STRK", amountUsd: 0.66, reasoning: "Diversifying a small amount into STRK at a good entry price.", txHash: "0x06c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3", outcome: "loss" },
    { id: 6, createdAt: new Date(Date.now() - 180 * 60000).toISOString(), action: "hold", pair: null, amountUsd: null, reasoning: "Just started. Scanning the market and learning the landscape.", txHash: null, outcome: "open" },
    { id: 7, createdAt: new Date(Date.now() - 210 * 60000).toISOString(), action: "swap", pair: "ETH\u2192USDC", amountUsd: 1.2, reasoning: "ETH up 4.1% since we bought. Locking in profits.", txHash: "0x07d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4", outcome: "profit" },
    { id: 8, createdAt: new Date(Date.now() - 240 * 60000).toISOString(), action: "hold", pair: null, amountUsd: null, reasoning: "Volatility is low. No reason to trade right now.", txHash: null, outcome: "open" },
    { id: 9, createdAt: new Date(Date.now() - 270 * 60000).toISOString(), action: "supply_vesu", pair: null, amountUsd: 1.5, reasoning: "Adding more to yield. Your total deposit is now earning passively.", txHash: "0x08e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5", outcome: "open" },
    { id: 10, createdAt: new Date(Date.now() - 300 * 60000).toISOString(), action: "swap", pair: "USDC\u2192ETH", amountUsd: 0.8, reasoning: "ETH at a weekly low. Small position to catch the rebound.", txHash: "0x09f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6", outcome: "profit" },
    { id: 11, createdAt: new Date(Date.now() - 330 * 60000).toISOString(), action: "hold", pair: null, amountUsd: null, reasoning: "Weekend market, low liquidity. Sitting this one out.", txHash: null, outcome: "open" },
    { id: 12, createdAt: new Date(Date.now() - 360 * 60000).toISOString(), action: "withdraw_vesu", pair: null, amountUsd: 1.0, reasoning: "Freeing up capital for a trade opportunity spotted ahead.", txHash: "0x0aa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7", outcome: "open" },
    { id: 13, createdAt: new Date(Date.now() - 390 * 60000).toISOString(), action: "swap", pair: "STRK\u2192USDC", amountUsd: 0.45, reasoning: "STRK up 8% since entry. Taking profit on this position.", txHash: "0x0bb8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8", outcome: "profit" },
    { id: 14, createdAt: new Date(Date.now() - 420 * 60000).toISOString(), action: "hold", pair: null, amountUsd: null, reasoning: "All positions looking healthy. No action needed.", txHash: null, outcome: "open" },
    { id: 15, createdAt: new Date(Date.now() - 450 * 60000).toISOString(), action: "swap", pair: "USDC\u2192STRK", amountUsd: 1.1, reasoning: "STRK dipped 5%. Buying back at a lower price than we sold.", txHash: "0x0cc9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9", outcome: "profit" },
  ],
  snapshots: [
    { createdAt: new Date(Date.now() - 180 * 60000).toISOString(), totalValueUsd: 10.0, pnlUsd: 0, pnlPct: 0 },
    { createdAt: new Date(Date.now() - 150 * 60000).toISOString(), totalValueUsd: 9.98, pnlUsd: -0.02, pnlPct: -0.2 },
    { createdAt: new Date(Date.now() - 120 * 60000).toISOString(), totalValueUsd: 10.01, pnlUsd: 0.01, pnlPct: 0.1 },
    { createdAt: new Date(Date.now() - 90 * 60000).toISOString(), totalValueUsd: 10.05, pnlUsd: 0.05, pnlPct: 0.5 },
    { createdAt: new Date(Date.now() - 60 * 60000).toISOString(), totalValueUsd: 10.12, pnlUsd: 0.12, pnlPct: 1.2 },
    { createdAt: new Date(Date.now() - 30 * 60000).toISOString(), totalValueUsd: 10.21, pnlUsd: 0.21, pnlPct: 2.1 },
  ],
  stats: { winRate: 60, totalTrades: 5, winningTrades: 3, losingTrades: 2, totalDecisions: 12, totalX402Spent: 0.012 },
  pnl: { usd: 0.21, pct: 2.1 },
};

const springEntrance = {
  type: "spring" as const,
  stiffness: 120,
  damping: 20,
};

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...springEntrance, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<StatusData>(DEMO_DATA);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async (wallet: string) => {
    if (!wallet) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/status?wallet=${wallet}`);
      if (res.ok) {
        const statusData = await res.json();
        setData(statusData);
        setIsDemo(false);
      }
    } catch {
      // Keep demo data on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for updates every 30 seconds when wallet is connected
  useEffect(() => {
    if (!walletAddress || isDemo) return;
    const interval = setInterval(() => fetchStatus(walletAddress), 30000);
    return () => clearInterval(interval);
  }, [walletAddress, isDemo, fetchStatus]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <OceanBackground />

      {/* Sticky frosted header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          background: "color-mix(in srgb, var(--ocean-deep) 80%, transparent)",
          borderBottom: "1px solid var(--liquid-border)",
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <Image src="/velalogo-clean.png" alt="Vela" width={24} height={24} />
          <span className="text-xl font-bold shimmer-text">Vela</span>
        </Link>
        <div className="flex items-center gap-4">
          {isDemo && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter wallet address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="px-3 py-1.5 rounded-lg glass text-sm font-mono w-48 sm:w-72 bg-transparent outline-none focus:border-[var(--vela-blue)]"
              />
              <button
                onClick={() => fetchStatus(walletAddress)}
                disabled={!walletAddress || loading}
                className="px-4 py-1.5 rounded-lg bg-[var(--vela-blue)] text-[var(--bg-primary)] text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? "..." : "Connect"}
              </button>
            </div>
          )}
          {isDemo && (
            <span className="text-xs text-[var(--vela-gold)] glass px-2 py-1 rounded">DEMO</span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Status row */}
        <AnimatedSection>
          <AgentStatus
            totalValueUsd={data.portfolio.totalValueUsd}
            pnlUsd={data.pnl.usd}
            pnlPct={data.pnl.pct}
            winRate={data.stats.winRate}
            totalDecisions={data.stats.totalDecisions}
            totalX402Spent={data.stats.totalX402Spent}
            sessionRemaining={isDemo ? "5d 14h" : undefined}
            isActive={!isDemo || true}
          />
        </AnimatedSection>

        {/* Chart + Portfolio */}
        <AnimatedSection delay={0.1}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PnlChart snapshots={data.snapshots} />
            </div>
            <PortfolioCard portfolio={data.portfolio} />
          </div>
        </AnimatedSection>

        {/* Activity */}
        <AnimatedSection delay={0.15}>
          <ActivityFeed decisions={data.decisions} />
        </AnimatedSection>

        {/* Stop agent */}
        <AnimatedSection delay={0.2}>
          <StopAgent
            isActive={!isDemo}
            onStop={() => {
              setIsDemo(true);
              setWalletAddress("");
            }}
          />
        </AnimatedSection>
      </main>
    </div>
  );
}
