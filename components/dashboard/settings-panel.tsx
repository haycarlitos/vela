"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { Tier } from "@/lib/demo-data";
import { TIER_LABELS, TIER_COLORS, TIER_FEATURES } from "@/lib/demo-data";

interface SettingsPanelProps {
  tier: Tier;
}

const spring = { type: "spring" as const, stiffness: 120, damping: 20 };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">{children}</p>
  );
}

function ToggleSwitch({ label, defaultOn = true }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <button
        onClick={() => setOn(!on)}
        className={`w-10 h-6 rounded-full transition-colors relative focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] outline-none ${
          on ? "bg-[#2BC2AE]" : "bg-[var(--glass-border)]"
        }`}
        role="switch"
        aria-checked={on}
        aria-label={label}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SliderDisplay({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-mono font-medium">{value}{suffix}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--glass-border)] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#44E1B4] to-[#2BC2AE]"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function SettingsPanel({ tier }: SettingsPanelProps) {
  const [walletCopied, setWalletCopied] = useState(false);
  const features = TIER_FEATURES[tier];

  return (
    <div className="space-y-4">
      {/* Tier & Account */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="glass p-6"
      >
        <SectionTitle>Your Plan</SectionTitle>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-bold px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${TIER_COLORS[tier]} 20%, transparent)`,
                color: TIER_COLORS[tier],
              }}
            >
              {TIER_LABELS[tier]}
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              {tier === "sailor" ? "Free" : tier === "navigator" ? "$1/mo" : tier === "captain" ? "$3/mo" : "$5/mo"}
            </span>
          </div>
          <Link
            href="/#pricing"
            className="text-sm font-medium text-[#44E1B4] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] outline-none rounded"
          >
            {tier === "pirate" ? "Change Plan" : "Upgrade"}
          </Link>
        </div>

        {/* Wallet */}
        <div className="mt-4 pt-4 border-t border-[var(--glass-border)] relative z-10">
          <SectionTitle>Wallet</SectionTitle>
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm text-[var(--text-secondary)] truncate">
              0x04a1b2c3...d8e9f0a1
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText("0x04a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1");
                setWalletCopied(true);
                setTimeout(() => setWalletCopied(false), 2000);
              }}
              className="text-xs text-[var(--vela-blue)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] outline-none rounded min-h-[44px] flex items-center"
            >
              {walletCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Session */}
        <div className="mt-4 pt-4 border-t border-[var(--glass-border)] relative z-10">
          <SectionTitle>Session Key</SectionTitle>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--vela-green)]" />
            <span className="text-sm text-[var(--text-secondary)]">Active — expires in 5d 14h</span>
          </div>
        </div>
      </motion.div>

      {/* Trading Settings (Navigator+) */}
      {features.trades && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
          className="glass p-6"
        >
          <SectionTitle>Trading</SectionTitle>
          <div className="space-y-4 relative z-10">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Max per trade</p>
                <div className="glass px-3 py-2 rounded-lg font-mono text-sm">$5.00</div>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Max per day</p>
                <div className="glass px-3 py-2 rounded-lg font-mono text-sm">$10.00</div>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">Trading Pairs</p>
              <div className="flex gap-2">
                {["ETH", "STRK", "wBTC"].map((token) => (
                  <label key={token} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#2BC2AE] w-4 h-4" />
                    <span className="text-sm text-[var(--text-secondary)]">{token}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* AI Settings (Captain+) */}
      {features.aiJudgment && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.15 }}
          className="glass p-6"
        >
          <SectionTitle>AI Behavior</SectionTitle>
          <div className="space-y-1 relative z-10">
            <ToggleSwitch label="Reviews news & sentiment" />
            <ToggleSwitch label="Checks on-chain volume" />
            <ToggleSwitch label="Evaluates past trade performance" />
          </div>

          {features.stopLossTakeProfit && (
            <div className="mt-4 pt-4 border-t border-[var(--glass-border)] space-y-4 relative z-10">
              <SectionTitle>Risk Management</SectionTitle>
              <SliderDisplay label="Stop-loss" value={5} suffix="%" />
              <SliderDisplay label="Take-profit" value={8} suffix="%" />
            </div>
          )}
        </motion.div>
      )}

      {/* Custom Strategy (Pirate only) */}
      {features.customStrategy && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
          className="glass p-6"
        >
          <SectionTitle>Custom Strategy</SectionTitle>
          <div className="space-y-4 relative z-10">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">Strategy Name</p>
              <input
                type="text"
                defaultValue="Momentum Alpha"
                className="w-full glass px-3 py-2 rounded-lg text-sm bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] min-h-[44px]"
              />
            </div>
            <SliderDisplay label="Risk Level" value={60} suffix="%" />
            <ToggleSwitch label="Visible on Leaderboard" />
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-3">Token Allocation</p>
              <div className="space-y-2">
                {[
                  { token: "USDC", pct: 30, color: "var(--vela-blue)" },
                  { token: "ETH", pct: 35, color: "var(--vela-gold)" },
                  { token: "STRK", pct: 20, color: "#CE93D8" },
                  { token: "wBTC", pct: 15, color: "var(--vela-red)" },
                ].map((a) => (
                  <div key={a.token} className="flex items-center gap-3">
                    <span className="w-12 text-xs text-[var(--text-secondary)]">{a.token}</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--glass-border)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${a.pct}%`, backgroundColor: a.color }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-xs text-[var(--text-muted)]">{a.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
