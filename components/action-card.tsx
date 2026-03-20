"use client";

import { motion } from "framer-motion";

interface ActionCardProps {
  action: string;
  pair?: string;
  amountUsd?: number;
  reasoning: string;
  txHash?: string;
  outcome?: string;
  timestamp: string;
}

function getIcon(action: string): string {
  switch (action) {
    case "swap": return "\u2194\uFE0F";
    case "supply_vesu": return "\U0001F4B0";
    case "withdraw_vesu": return "\U0001F3E6";
    case "hold": return "\u23F8\uFE0F";
    default: return "\u2753";
  }
}

export function ActionCard({ action, pair, amountUsd, reasoning, txHash, outcome, timestamp }: ActionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01 }}
      className="glass p-4 cursor-default"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{getIcon(action)}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm uppercase">{action.replace("_", " ")}</span>
            {pair && <span className="text-xs text-[var(--text-muted)] font-mono">{pair}</span>}
            {amountUsd != null && (
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                ${amountUsd.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{reasoning}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-[var(--text-muted)]">{timestamp}</span>
            {txHash && (
              <a
                href={`https://voyager.online/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--vela-blue)] hover:underline font-mono"
              >
                tx
              </a>
            )}
            {outcome && outcome !== "open" && (
              <span
                className={`text-xs ${
                  outcome === "profit" ? "text-[var(--vela-green)]" : "text-[var(--vela-red)]"
                }`}
              >
                {outcome}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
