"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const features = [
  {
    title: "Session Keys",
    description: "On-chain spending caps. Your agent can only do what you allow.",
    icon: "🔐",
  },
  {
    title: "Gasless Execution",
    description: "Paymaster-sponsored transactions. Zero gas fees, ever.",
    icon: "⛽",
  },
  {
    title: "Pay-Per-Think",
    description: "$0.001 per decision via x402 micropayments. The agent pays for its own brain.",
    icon: "🧠",
  },
  {
    title: "DeFi on Autopilot",
    description: "AVNU swaps, Vesu yields, automatic rebalancing — 24/7.",
    icon: "📈",
  },
];

const steps = [
  { step: "1", title: "Create Wallet", description: "Passkey-protected Starknet wallet in seconds" },
  { step: "2", title: "Fund with USDC", description: "Send $10+ USDC to get started" },
  { step: "3", title: "Hire Your Agent", description: "Set spending caps, pick a strategy, confirm with PIN" },
  { step: "4", title: "Watch It Work", description: "Real-time dashboard with every decision explained" },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-4">
            <span className="gradient-text">Vela</span>
          </h1>
          <p className="text-xl sm:text-2xl text-[var(--text-secondary)] mb-2 font-light">
            Set sail. Let AI navigate.
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-10 max-w-md mx-auto">
            Hire an autonomous DeFi agent that trades, earns yield, and rebalances your portfolio
            while you sleep. Powered by session keys, gasless execution, and x402 micropayments.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link
            href="/dashboard"
            className="px-8 py-3 rounded-full font-medium text-[var(--bg-primary)] bg-[var(--vela-blue)] hover:brightness-110 transition-all duration-300"
          >
            Get Started
          </Link>
          <a
            href="#how-it-works"
            className="px-8 py-3 rounded-full font-medium glass text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-all duration-300"
          >
            How It Works
          </a>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
              className="glass p-6 hover:scale-[1.02] transition-transform duration-300"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-12 gradient-text">How It Works</h2>
        <div className="space-y-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
              className="glass p-5 flex items-start gap-5"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--vela-blue)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-lg shrink-0">
                {s.step}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{s.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Agent demo preview */}
      <section className="px-6 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-4 gradient-text">What Your Agent Does</h2>
        <p className="text-center text-[var(--text-secondary)] mb-10 max-w-xl mx-auto">
          Every 30 minutes, your agent scans the market and makes autonomous decisions. Here&apos;s what a typical day looks like:
        </p>
        <div className="glass p-6 space-y-3 font-mono text-sm">
          {[
            { time: "14:30", action: "HOLD", detail: "No opportunity — ETH flat, spreads wide", type: "hold" },
            { time: "14:00", action: "SWAP", detail: "USDC→ETH $2.00 — ETH down 6.2%, mean reversion", type: "profit" },
            { time: "13:30", action: "HOLD", detail: "Price impact 1.8% on small amount — not worth it", type: "hold" },
            { time: "13:00", action: "SUPPLY", detail: "USDC→Vesu $3.00 — APY 6.2%, idle capital working", type: "supply" },
            { time: "12:30", action: "SWAP", detail: "USDC→STRK $0.66 — initial diversification", type: "profit" },
            { time: "12:00", action: "HOLD", detail: "First cycle — gathering market data", type: "hold" },
          ].map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.08 * i }}
              className={`glass p-3 flex items-center gap-4 ${
                entry.type === "profit" ? "glass-profit" : entry.type === "supply" ? "glass-supply" : "glass-hold"
              }`}
            >
              <span className="text-[var(--text-muted)] w-12 shrink-0">{entry.time}</span>
              <span
                className={`font-semibold w-16 shrink-0 ${
                  entry.action === "SWAP"
                    ? "text-[var(--vela-green)]"
                    : entry.action === "SUPPLY"
                      ? "text-[var(--vela-blue)]"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {entry.action}
              </span>
              <span className="text-[var(--text-secondary)] truncate">{entry.detail}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to set sail?</h2>
        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
          Start with $10 USDC. Your agent will trade, earn yield, and report back — all while you sleep.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-10 py-4 rounded-full font-medium text-lg text-[var(--bg-primary)] bg-[var(--vela-blue)] hover:brightness-110 transition-all duration-300"
        >
          Hire Your Agent
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-xs text-[var(--text-muted)] border-t border-[var(--glass-border)]">
        <p>Powered by <span className="text-[var(--text-secondary)]">Chipi Pay</span> — Session keys, gasless execution, x402 micropayments on Starknet</p>
      </footer>
    </div>
  );
}
