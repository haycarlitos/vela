"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Tier, LeaderboardEntry } from "@/lib/demo-data";
import { TIER_LABELS, TIER_COLORS } from "@/lib/demo-data";

interface LeaderboardCardProps {
  tier: Tier;
  entries: LeaderboardEntry[];
}

const spring = { type: "spring" as const, stiffness: 120, damping: 20 };

export function LeaderboardCard({ tier, entries }: LeaderboardCardProps) {
  const isPirate = tier === "pirate";
  const currentUser = entries.find((e) => e.isCurrentUser);

  return (
    <div className="space-y-4">
      {/* Pirate: Your Strategy card */}
      {isPirate && currentUser && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="glass-liquid p-6"
        >
          <div className="flex items-center justify-between mb-3 relative z-10">
            <h3 className="text-lg font-semibold shimmer-text">Your Strategy</h3>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--vela-green)]/20 text-[var(--vela-green)]">
              Public
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 relative z-10">
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Strategy</p>
              <p className="font-medium text-sm mt-1">{currentUser.strategy}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Return</p>
              <p className="font-mono font-bold text-sm mt-1 text-[var(--vela-green)]">
                +{currentUser.monthlyReturn.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Rank</p>
              <p className="font-mono font-bold text-sm mt-1">#{currentUser.rank}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      <div className="glass p-6">
        <div className="mb-4 relative z-10">
          <h3 className="text-lg font-semibold shimmer-text inline-block">Leaderboard</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Top 5 earn weekly Treasure tickets
          </p>
        </div>

        <div
          className="space-y-2 overflow-y-auto pr-1 scroll-fade relative z-10"
          style={{ maxHeight: "28rem" }}
        >
          {entries.map((entry, i) => (
            <motion.div
              key={entry.username}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.04 * i }}
              className={`glass glass-interactive p-3 flex items-center gap-3 ${
                entry.isCurrentUser ? "border-l-2 border-[var(--vela-blue)]" : ""
              }`}
              style={
                entry.isCurrentUser
                  ? { background: "linear-gradient(135deg, var(--caustic-blue), var(--liquid-bg))" }
                  : undefined
              }
            >
              {/* Rank */}
              <span
                className={`w-7 text-center font-mono font-bold text-sm shrink-0 ${
                  entry.rank <= 3 ? "text-[var(--vela-gold)]" : "text-[var(--text-muted)]"
                }`}
              >
                {entry.rank}
              </span>

              {/* Username */}
              <span className={`text-sm font-medium min-w-0 truncate ${entry.isCurrentUser ? "text-[var(--vela-blue)]" : ""}`}>
                {entry.isCurrentUser ? "you" : entry.username}
              </span>

              {/* Strategy (hidden on mobile) */}
              <span className="text-xs text-[var(--text-muted)] hidden sm:block flex-1 truncate">
                {entry.strategy}
              </span>

              {/* Spacer on mobile */}
              <span className="flex-1 sm:hidden" />

              {/* Weekly tickets badge */}
              {entry.weeklyTickets > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--vela-gold)]/20 text-[var(--vela-gold)] shrink-0">
                  {entry.weeklyTickets} tix
                </span>
              )}

              {/* Return */}
              <span className="font-mono font-bold text-sm text-[var(--vela-green)] shrink-0">
                +{entry.monthlyReturn.toFixed(1)}%
              </span>

              {/* Tier badge */}
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${TIER_COLORS[entry.tier]} 20%, transparent)`,
                  color: TIER_COLORS[entry.tier],
                }}
              >
                {TIER_LABELS[entry.tier]}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Upgrade prompt for non-pirates */}
        {!isPirate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...spring, delay: 0.4 }}
            className="mt-4 text-center relative z-10"
          >
            <Link
              href="/#pricing"
              className="inline-flex text-xs font-medium px-4 py-2 rounded-full glass text-[var(--vela-gold)] hover:bg-[var(--glass-hover)] transition-all min-h-[44px] items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] outline-none"
            >
              Upgrade to Pirate to compete
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
