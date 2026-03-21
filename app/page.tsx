"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { OceanBackground } from "@/components/ocean-background";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    title: "Session Keys",
    description: "On-chain spending caps. Your agent can only do what you allow.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
  },
  {
    title: "Gasless Execution",
    description: "Paymaster-sponsored transactions. Zero gas fees, ever.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: "Pay-Per-Think",
    description: "$0.001 per decision via x402 micropayments. The agent pays for its own brain.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" />
        <path d="M12 18v4" />
        <path d="M8 22h8" />
        <path d="M9 10h.01" />
        <path d="M15 10h.01" />
        <path d="M9.5 14a3 3 0 0 0 5 0" />
      </svg>
    ),
  },
  {
    title: "DeFi on Autopilot",
    description: "AVNU swaps, Vesu yields, automatic rebalancing — 24/7.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
];

const steps = [
  { step: "1", title: "Create Wallet", description: "Passkey-protected Starknet wallet in seconds" },
  { step: "2", title: "Fund with USDC", description: "Send $10+ USDC to get started" },
  { step: "3", title: "Hire Your Agent", description: "Set spending caps, pick a strategy, confirm with PIN" },
  { step: "4", title: "Watch It Work", description: "Real-time dashboard with every decision explained" },
];

const demoEntries = [
  { time: "14:30", action: "HOLD", detail: "No opportunity — ETH flat, spreads wide", type: "hold" },
  { time: "14:00", action: "SWAP", detail: "USDC\u2192ETH $2.00 — ETH down 6.2%, mean reversion", type: "profit" },
  { time: "13:30", action: "HOLD", detail: "Price impact 1.8% on small amount — not worth it", type: "hold" },
  { time: "13:00", action: "SUPPLY", detail: "USDC\u2192Vesu $3.00 — APY 6.2%, idle capital working", type: "supply" },
  { time: "12:30", action: "SWAP", detail: "USDC\u2192STRK $0.66 — initial diversification", type: "profit" },
  { time: "12:00", action: "HOLD", detail: "First cycle — gathering market data", type: "hold" },
];

const springEntrance = {
  type: "spring" as const,
  stiffness: 120,
  damping: 20,
};

function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how-it-works" className="px-6 py-16 max-w-3xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-12 gradient-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={springEntrance}
      >
        How It Works
      </motion.h2>
      <div className="relative space-y-6">
        {/* Vertical connecting line */}
        <motion.div
          className="absolute left-[27px] top-5 bottom-5 w-px hidden sm:block"
          style={{
            background: "linear-gradient(180deg, var(--vela-blue), transparent)",
          }}
          initial={{ scaleY: 0 }}
          animate={isInView ? { scaleY: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {steps.map((s, i) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ ...springEntrance, delay: 0.1 * i }}
            className="glass glass-interactive p-5 flex items-start gap-5"
          >
            <div
              className="w-10 h-10 rounded-full bg-[var(--vela-blue)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-lg shrink-0"
            >
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
  );
}

function DemoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section className="px-6 py-16 max-w-4xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-4 gradient-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={springEntrance}
      >
        What Your Agent Does
      </motion.h2>
      <motion.p
        className="text-center text-[var(--text-secondary)] mb-10 max-w-xl mx-auto"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.1 }}
      >
        Every 30 minutes, your agent scans the market and makes autonomous decisions. Here&apos;s what a typical day looks like:
      </motion.p>
      <div className="space-y-3 font-mono text-sm">
        {demoEntries.map((entry, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              type: "spring",
              stiffness: 100,
              damping: 20,
              delay: 0.08 * i,
            }}
            className={`glass glass-interactive p-3 flex items-center gap-4 ${
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
  );
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative">
      <OceanBackground />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-bold gradient-text">Vela</span>
        <ThemeToggle />
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springEntrance}
          className="relative z-10"
        >
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-4">
            <span className="gradient-text">Vela</span>
          </h1>
          <motion.p
            className="text-xl sm:text-2xl text-[var(--text-primary)] mb-2 font-light"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springEntrance, delay: 0.1 }}
          >
            Set sail. Let AI navigate.
          </motion.p>
          <motion.p
            className="text-sm text-[var(--text-secondary)] mb-10 max-w-md mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springEntrance, delay: 0.2 }}
          >
            Hire an autonomous DeFi agent that trades, earns yield, and rebalances your portfolio
            while you sleep. Powered by session keys, gasless execution, and x402 micropayments.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springEntrance, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 relative z-10"
        >
          <Link
            href="/dashboard"
            className="glass-liquid px-8 py-3 rounded-full font-medium text-[var(--text-primary)] hover:brightness-110 transition-all duration-300 text-center"
          >
            Try Demo
          </Link>
          <a
            href="#how-it-works"
            className="px-8 py-3 rounded-full font-medium glass text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-all duration-300"
          >
            How It Works
          </a>
        </motion.div>
      </section>

      {/* Wave divider */}
      <div className="w-full overflow-hidden" style={{ height: 48 }}>
        <svg viewBox="0 0 1440 48" fill="none" preserveAspectRatio="none" className="w-full h-full">
          <path
            d="M0 24C360 0 720 48 1080 24C1260 12 1380 24 1440 24"
            stroke="url(#wave-gradient)"
            strokeWidth="1.5"
            fill="none"
          />
          <defs>
            <linearGradient id="wave-gradient" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--vela-blue)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--vela-blue)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--vela-blue)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springEntrance, delay: 0.1 * i }}
              className="glass glass-interactive p-6 group"
            >
              <div className="text-[var(--vela-blue)] mb-3 transition-colors group-hover:text-[var(--vela-gold)]">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{feature.description}</p>
              {/* Corner refraction accent */}
              <div
                className="absolute top-0 right-0 w-16 h-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at 100% 0%, var(--caustic-blue), transparent 70%)",
                  borderRadius: "0 20px 0 0",
                }}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Wave divider */}
      <div className="w-full overflow-hidden" style={{ height: 48 }}>
        <svg viewBox="0 0 1440 48" fill="none" preserveAspectRatio="none" className="w-full h-full">
          <path
            d="M0 24C240 48 480 0 720 24C960 48 1200 0 1440 24"
            stroke="url(#wave-gradient-2)"
            strokeWidth="1.5"
            fill="none"
          />
          <defs>
            <linearGradient id="wave-gradient-2" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--vela-blue)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--caustic-teal)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--vela-blue)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* How it works */}
      <HowItWorksSection />

      {/* Agent demo preview */}
      <DemoSection />

      {/* CTA */}
      <section className="px-6 py-20 text-center relative">
        <motion.h2
          className="text-3xl font-bold mb-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Ready to set sail?
        </motion.h2>
        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
          Start with $10 USDC. Your agent will trade, earn yield, and report back — all while you sleep.
        </p>
        <Link
          href="/dashboard"
          className="glass-liquid inline-block px-10 py-4 rounded-full font-medium text-lg text-[var(--text-primary)] hover:brightness-110 transition-all duration-300"
        >
          Try Demo
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-xs text-[var(--text-muted)] border-t border-[var(--glass-border)]">
        <p>Powered by <span className="text-[var(--text-secondary)]">Chipi Pay</span> — Session keys, gasless execution, x402 micropayments on Starknet</p>
      </footer>
    </div>
  );
}
