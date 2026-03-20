"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Strategy = "conservative" | "balanced" | "aggressive";

interface ConfigureAgentProps {
  balance: number;
  onHired: (config: { strategy: Strategy; maxPerTrade: number; maxPerDay: number; duration: number }) => void;
}

const strategies: { key: Strategy; label: string; description: string }[] = [
  { key: "conservative", label: "Conservative", description: "Yield only — supply to Vesu, no trading" },
  { key: "balanced", label: "Balanced", description: "Yield + small trades when profitable" },
  { key: "aggressive", label: "Aggressive", description: "Active trading + yield optimization" },
];

export function ConfigureAgent({ balance, onHired }: ConfigureAgentProps) {
  const [strategy, setStrategy] = useState<Strategy>("balanced");
  const [maxPerTrade, setMaxPerTrade] = useState(Math.min(5, balance / 2));
  const [maxPerDay, setMaxPerDay] = useState(Math.min(10, balance));
  const [duration, setDuration] = useState(7);
  const [loading, setLoading] = useState(false);

  const weeklyX402Cost = (48 * duration * 0.001).toFixed(2);

  const handleHire = async () => {
    setLoading(true);
    try {
      // In production:
      // 1. createSession({ durationSeconds: duration * 86400 })
      // 2. registerSession({ maxCalls: 500, allowedEntrypoints: [...] })
      // 3. setSpendingPolicy({ maxPerCall, maxPerWindow, windowSeconds: 86400 })
      await new Promise((resolve) => setTimeout(resolve, 2000));
      onHired({ strategy, maxPerTrade, maxPerDay, duration });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 max-w-lg mx-auto"
    >
      <h2 className="text-2xl font-bold mb-6 text-center">Configure Your Agent</h2>

      {/* Strategy */}
      <div className="mb-6">
        <label className="text-sm font-medium text-[var(--text-secondary)] mb-3 block">Strategy</label>
        <div className="space-y-2">
          {strategies.map((s) => (
            <button
              key={s.key}
              onClick={() => setStrategy(s.key)}
              className={`w-full glass p-3 text-left transition-all ${
                strategy === s.key
                  ? "border-[var(--vela-blue)] bg-[var(--vela-blue)]/10"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    strategy === s.key
                      ? "border-[var(--vela-blue)] bg-[var(--vela-blue)]"
                      : "border-[var(--text-muted)]"
                  }`}
                />
                <div>
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{s.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="mb-6">
        <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
          Duration
        </label>
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full glass p-3 bg-transparent outline-none text-sm"
        >
          <option value={1}>1 day</option>
          <option value={3}>3 days</option>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      {/* Spending caps */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
            Max per trade ($)
          </label>
          <input
            type="number"
            value={maxPerTrade}
            onChange={(e) => setMaxPerTrade(Number(e.target.value))}
            min={0.5}
            max={balance}
            step={0.5}
            className="w-full glass p-3 bg-transparent outline-none text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
            Max per day ($)
          </label>
          <input
            type="number"
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(Number(e.target.value))}
            min={1}
            max={balance * 2}
            step={1}
            className="w-full glass p-3 bg-transparent outline-none text-sm font-mono"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="glass p-4 mb-6 space-y-2 text-sm">
        <p className="font-medium text-[var(--text-secondary)]">Your agent will:</p>
        <ul className="space-y-1 text-[var(--text-secondary)]">
          <li>Monitor prices every 30 min</li>
          {strategy !== "conservative" && <li>Trade on AVNU when profitable</li>}
          <li>Earn yield on Vesu</li>
          <li>Pay $0.001 per decision (x402)</li>
          <li>Never exceed your spending caps</li>
        </ul>
        <p className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--glass-border)]">
          Estimated x402 cost: ${weeklyX402Cost} for {duration} days
        </p>
      </div>

      {/* Hire button */}
      <button
        onClick={handleHire}
        disabled={loading}
        className="w-full py-4 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-semibold text-lg hover:brightness-110 transition-all disabled:opacity-50"
      >
        {loading ? "Setting up session..." : "Hire Agent"}
      </button>
    </motion.div>
  );
}
