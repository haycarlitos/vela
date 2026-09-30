"use client";

import { motion } from "framer-motion";

interface PortfolioCardProps {
  portfolio: {
    totalValueUsd: number;
    usdc: { balance: number; usd: number };
    eth: { balance: number; usd: number; price: number };
    strk: { balance: number; usd: number; price: number };
    vesuDeposited: number;
    /** Omitted when unknown. */
    vesuApy?: number;
  };
}

const tokenColors: Record<string, string> = {
  usdc: "var(--vela-blue)",
  vesu: "var(--vela-green)",
  eth: "var(--vela-gold)",
  strk: "#CE93D8",
};

const springEntrance = {
  type: "spring" as const,
  stiffness: 120,
  damping: 20,
};

export function PortfolioCard({ portfolio }: PortfolioCardProps) {
  const rows = [
    { label: "USDC (liquid)", value: portfolio.usdc.usd, sub: null, color: tokenColors.usdc },
    { label: "USDC (Vesu)", value: portfolio.vesuDeposited, sub: portfolio.vesuApy === undefined ? null : `${portfolio.vesuApy.toFixed(1)}% APY`, color: tokenColors.vesu },
    { label: "ETH", value: portfolio.eth.usd, sub: portfolio.eth.balance.toFixed(6), color: tokenColors.eth },
    { label: "STRK", value: portfolio.strk.usd, sub: portfolio.strk.balance.toFixed(4), color: tokenColors.strk },
  ];

  return (
    <div className="glass p-6 space-y-4">
      <h3 className="text-lg font-semibold">Portfolio</h3>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            className="flex justify-between items-center group"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springEntrance, delay: 0.05 * i }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-sm text-[var(--text-secondary)]">{row.label}</span>
            </div>
            <span className="font-mono text-sm">
              ${row.value.toFixed(2)}
              {row.sub && (
                <span
                  className="text-xs ml-1"
                  style={{ color: row.label.includes("Vesu") ? "var(--vela-green)" : "var(--text-muted)" }}
                >
                  {row.sub}
                </span>
              )}
            </span>
          </motion.div>
        ))}
        <div className="border-t border-[var(--glass-border)] pt-3 flex justify-between items-center">
          <span className="text-sm font-medium">Total</span>
          <motion.span
            key={portfolio.totalValueUsd}
            className="font-mono font-bold"
            initial={{ opacity: 0.5, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ${portfolio.totalValueUsd.toFixed(2)}
          </motion.span>
        </div>
      </div>
    </div>
  );
}
