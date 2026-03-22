"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Tier, TreasureData } from "@/lib/demo-data";
import { useState } from "react";

interface TreasureCardProps {
  tier: Tier;
  data: TreasureData;
}

const spring = { type: "spring" as const, stiffness: 120, damping: 20 };

export function TreasureCard({ tier, data }: TreasureCardProps) {
  const [copied, setCopied] = useState(false);
  const isPirate = tier === "pirate";

  return (
    <div className="glass-liquid p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <h3 className="text-lg font-semibold shimmer-text">The Treasure</h3>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--vela-gold)]/20 text-[var(--vela-gold)]">
          Monthly Draw
        </span>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-3 gap-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="space-y-1"
        >
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Prize Pool</p>
          <p className="text-2xl font-bold font-mono text-[var(--vela-gold)]">
            ${data.prizePool.toFixed(2)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="space-y-1"
        >
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Days Left</p>
          <p className="text-2xl font-bold font-mono">
            {data.daysUntilDraw}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
          className="space-y-1"
        >
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Your Tickets</p>
          <p className="text-2xl font-bold font-mono text-[var(--vela-green)]">
            {data.tickets}
          </p>
        </motion.div>
      </div>

      {/* Ticket breakdown */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...spring, delay: 0.15 }}
        className="glass p-4 rounded-xl space-y-2 relative z-10"
      >
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Your Tickets</p>
        {data.breakdown.map((b) => (
          <div key={b.source} className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">{b.source}</span>
            <span className="font-mono font-medium">{b.count}</span>
          </div>
        ))}
      </motion.div>

      {/* How to earn */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...spring, delay: 0.2 }}
        className="space-y-3 relative z-10"
      >
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">How to Earn Tickets</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="glass p-3 rounded-xl text-center">
            <p className="text-sm font-medium">Invite a friend</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">1 ticket per referral</p>
            {isPirate && (
              <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--vela-gold)]/20 text-[var(--vela-gold)]">
                Pirate: 2x
              </span>
            )}
          </div>
          <div className="glass p-3 rounded-xl text-center">
            <p className="text-sm font-medium">Weekly top 5</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">1-5 tickets per week</p>
          </div>
          <div className="glass p-3 rounded-xl text-center">
            <p className="text-sm font-medium">Pirate tier</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">2x referral tickets</p>
            {!isPirate && (
              <Link
                href="/#pricing"
                className="inline-block mt-1.5 text-xs font-medium text-[var(--vela-gold)] hover:underline"
              >
                Upgrade
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Referral link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...spring, delay: 0.25 }}
        className="glass p-4 rounded-xl relative z-10"
      >
        <p className="text-xs text-[var(--text-muted)] mb-2">Your referral link</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm text-[var(--text-primary)] truncate">
            vela.app/r/yourname
          </code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText("https://vela.app/r/yourname");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="shrink-0 px-3 py-1.5 rounded-lg glass text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-all min-h-[44px] flex items-center focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] outline-none"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">Share to earn tickets</p>
      </motion.div>

      {/* Tagline */}
      <p className="text-center text-sm text-[var(--text-secondary)] relative z-10">
        Every tier competes. Every user has a chance.
      </p>
    </div>
  );
}
