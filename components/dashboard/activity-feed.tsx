"use client";

import { motion } from "framer-motion";

interface DecisionEntry {
  id: number;
  createdAt: string;
  action: string;
  pair: string | null;
  amountUsd: number | null;
  reasoning: string | null;
  txHash: string | null;
  outcome: string;
}

interface ActivityFeedProps {
  decisions: DecisionEntry[];
}

function getActionColor(action: string, outcome: string): string {
  if (action === "hold") return "text-[var(--text-muted)]";
  if (action === "supply_vesu" || action === "withdraw_vesu") return "text-[var(--vela-blue)]";
  if (outcome === "profit") return "text-[var(--vela-green)]";
  if (outcome === "loss") return "text-[var(--vela-red)]";
  return "text-[var(--vela-gold)]";
}

function getBorderClass(action: string, outcome: string): string {
  if (action === "hold") return "glass-hold";
  if (action === "supply_vesu" || action === "withdraw_vesu") return "glass-supply";
  if (outcome === "profit") return "glass-profit";
  if (outcome === "loss") return "glass-loss";
  return "";
}

function formatAction(action: string): string {
  switch (action) {
    case "swap": return "SWAP";
    case "supply_vesu": return "SUPPLY";
    case "withdraw_vesu": return "WITHDRAW";
    case "hold": return "HOLD";
    default: return action.toUpperCase();
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const springEntrance = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
};

export function ActivityFeed({ decisions }: ActivityFeedProps) {
  if (decisions.length === 0) {
    return (
      <div className="glass p-8 text-center text-[var(--text-muted)]">
        <p className="text-lg mb-2">No decisions yet</p>
        <p className="text-sm">Your agent will start making decisions once activated.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
      {decisions.map((d, i) => (
        <motion.div
          key={d.id}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springEntrance, delay: 0.05 * i }}
          className={`glass glass-interactive p-4 ${getBorderClass(d.action, d.outcome)}`}
          style={{ transition: "filter 0.5s ease" }}
        >
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className={`font-mono font-bold text-sm ${getActionColor(d.action, d.outcome)}`}>
                  {formatAction(d.action)}
                </span>
                {d.pair && (
                  <span className="text-sm text-[var(--text-secondary)] font-mono">{d.pair}</span>
                )}
                {d.amountUsd != null && (
                  <span className="text-sm text-[var(--text-secondary)] font-mono">
                    ${d.amountUsd.toFixed(2)}
                  </span>
                )}
                {d.outcome !== "open" && d.action === "swap" && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.outcome === "profit"
                        ? "bg-[var(--vela-green)]/20 text-[var(--vela-green)]"
                        : "bg-[var(--vela-red)]/20 text-[var(--vela-red)]"
                    }`}
                  >
                    {d.outcome}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{d.reasoning}</p>
              {d.txHash && (
                <a
                  href={`https://voyager.online/tx/${d.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--vela-blue)] hover:underline mt-1 inline-block font-mono"
                >
                  {d.txHash.slice(0, 10)}...{d.txHash.slice(-6)}
                </a>
              )}
            </div>
            <span className="text-xs text-[var(--text-muted)] shrink-0">{timeAgo(d.createdAt)}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
