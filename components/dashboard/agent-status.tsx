"use client";

import { motion } from "framer-motion";

interface AgentStatusProps {
  totalValueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  winRate: number;
  totalDecisions: number;
  totalX402Spent: number;
  sessionRemaining?: string;
  isActive: boolean;
}

export function AgentStatus({
  totalValueUsd,
  pnlUsd,
  pnlPct,
  winRate,
  totalDecisions,
  totalX402Spent,
  sessionRemaining,
  isActive,
}: AgentStatusProps) {
  const isProfitable = pnlUsd >= 0;

  return (
    <div className="glass p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${isActive ? "bg-[var(--vela-green)] animate-pulse" : "bg-[var(--text-muted)]"}`}
          />
          <span className="font-semibold text-lg">
            {isActive ? "Vela is Sailing" : "Agent Idle"}
          </span>
        </div>
        {sessionRemaining && (
          <span className="text-sm text-[var(--text-muted)]">{sessionRemaining} remaining</span>
        )}
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <motion.div
          key={totalValueUsd}
          initial={{ opacity: 0.5, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Portfolio</p>
          <p className="text-2xl font-bold font-mono">${totalValueUsd.toFixed(2)}</p>
        </motion.div>

        <motion.div
          key={pnlUsd}
          initial={{ opacity: 0.5, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">P&L</p>
          <p
            className={`text-2xl font-bold font-mono ${isProfitable ? "text-[var(--vela-green)]" : "text-[var(--vela-red)]"}`}
          >
            {isProfitable ? "+" : ""}${pnlUsd.toFixed(2)}{" "}
            <span className="text-sm">({isProfitable ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
          </p>
        </motion.div>

        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Win Rate</p>
          <p className="text-2xl font-bold font-mono">{winRate.toFixed(0)}%</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Decisions</p>
          <p className="text-2xl font-bold font-mono">{totalDecisions}</p>
          <p className="text-xs text-[var(--text-muted)]">x402: ${totalX402Spent.toFixed(3)}</p>
        </div>
      </div>
    </div>
  );
}
