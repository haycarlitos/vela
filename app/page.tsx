"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { OceanBackground } from "@/components/ocean-background";
import { ThemeToggle } from "@/components/theme-toggle";

const springEntrance = {
  type: "spring" as const,
  stiffness: 120,
  damping: 20,
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const tiers = [
  {
    name: "Sailor",
    price: "Free",
    tagline: "Your savings account for crypto.",
    description:
      "Your USDC earns interest. Vela moves it to the best pool automatically. No trading, no risk.",
    features: [
      "Yield on USDC (3-7% APY)",
      "Auto-switches between Vesu and Nostra",
      "Real-time monitoring",
      "Shareable performance card",
      "Compete for the Treasure",
    ],
    simulation: { portfolio: 100, monthly: 0.43, annual: 5.2, label: "~5% APY" },
    cta: "Start Free",
    highlight: false,
    color: "var(--vela-blue)",
  },
  {
    name: "Navigator",
    price: "$1",
    period: "/mo",
    tagline: "A robot that follows the rules.",
    description:
      "Vela watches the market 24/7 and trades when the numbers say so. Buy the dip. Sell the rally. No emotions.",
    features: [
      "Everything in Sailor +",
      "Buys and sells ETH, STRK, wBTC",
      "Real-time triggers (not polling)",
      "Up to 5 trades per day",
      "Referral tickets for the Treasure",
    ],
    simulation: { portfolio: 200, monthly: 0.8, annual: 4.8, label: "~5% + trades" },
    cta: "Start for $1",
    highlight: false,
    color: "var(--vela-green)",
  },
  {
    name: "Captain",
    price: "$3",
    period: "/mo",
    tagline: "An AI that reads the market.",
    description:
      "Same real-time trading, plus AI that reads news, sentiment, and your history. Protects you when things drop.",
    features: [
      "Everything in Navigator +",
      "AI judgment on every trade",
      "Stop-loss and take-profit",
      "News and sentiment analysis",
      "STRK liquid staking (Endur)",
      "Ask AI: \"How is my strategy doing?\"",
    ],
    simulation: { portfolio: 300, monthly: 1.09, annual: 4.4, label: "trades + protection" },
    cta: "Start for $3",
    highlight: true,
    color: "#44E1B4",
  },
  {
    name: "Pirate",
    price: "$5",
    period: "/mo",
    tagline: "You set the rules. Vela follows them.",
    description:
      "Full control over every parameter. Your strategy runs on the leaderboard. For people who enjoy the game.",
    features: [
      "Everything in Captain +",
      "Custom risk, tokens, thresholds",
      "Your strategy on the leaderboard",
      "Fastest signal cycles",
      "Unlimited AI consultations",
      "All current and future protocols",
    ],
    simulation: { portfolio: 300, monthly: null, annual: null, label: "you decide" },
    cta: "Start for $5",
    highlight: false,
    color: "var(--vela-gold)",
  },
];

const judgmentExamples = [
  {
    scenario: "RSI says buy ETH, but you're already 60% in ETH",
    rules: "Buys more (signal fired)",
    ai: "\"Too concentrated. Skip.\"",
  },
  {
    scenario: "RSI says buy, volume is dying, BTC dominance rising",
    rules: "Buys (signal is signal)",
    ai: "\"Weak setup. Wait for confirmation.\"",
  },
  {
    scenario: "Your last 5 STRK buys all lost money",
    rules: "Buys again (rule is rule)",
    ai: "\"STRK strategy has 20% win rate. Stopping.\"",
  },
  {
    scenario: "Starknet Foundation announces 100M grant program",
    rules: "Doesn't know",
    ai: "\"Bullish for STRK. Increasing position.\"",
  },
];

const demoEntries = [
  { time: "Now", action: "TRIGGER", detail: "ETH RSI crossed below 30 (oversold signal)", type: "signal" },
  { time: "2s ago", action: "AI", detail: "Confirmed: oversold + volume spike + your ETH strategy has 75% win rate", type: "ai" },
  { time: "5s ago", action: "BUY", detail: "Bought $15 ETH via AVNU. Entry: $2,469", type: "profit" },
  { time: "18 min", action: "HOLD", detail: "STRK signal fired but AI said: \"Your STRK trades are losing. Skip.\"", type: "hold" },
  { time: "1h ago", action: "YIELD", detail: "Moved $20 USDC from Vesu (4.1%) to Nostra (6.8%)", type: "supply" },
  { time: "3h ago", action: "SELL", detail: "Take-profit: ETH hit +6% from entry. Locked $1.80 gain.", type: "profit" },
  { time: "5h ago", action: "PROTECT", detail: "Stop-loss: STRK dropped 4%. Sold to limit damage to -$0.30", type: "loss" },
];

const steps = [
  {
    step: "1",
    title: "Create Your Wallet",
    description: "No seed phrases, no extensions. Just your fingerprint. 10 seconds.",
  },
  {
    step: "2",
    title: "Add USDC",
    description: "Send USDC to your wallet. $5 minimum for yield, $75+ for trading.",
  },
  {
    step: "3",
    title: "Pick Your Tier",
    description: "Sailor, Navigator, Captain, or Pirate. Start free, upgrade anytime.",
  },
  {
    step: "4",
    title: "Your Agent Goes to Work",
    description: "Watch every decision, every reason, every result. In real time.",
  },
];

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function TierSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="pricing" className="px-6 py-16 max-w-6xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-3 shimmer-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={springEntrance}
      >
        Pick Your Style
      </motion.h2>
      <motion.p
        className="text-center text-[var(--text-secondary)] mb-12 max-w-lg mx-auto"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.1 }}
      >
        Everyone gets real-time monitoring. Everyone competes for the Treasure. Upgrade for more power.
      </motion.p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ ...springEntrance, delay: 0.08 * i }}
            className={`${tier.highlight ? "glass-liquid" : "glass"} glass-interactive p-6 flex flex-col relative`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#44E1B4] to-[#2BC2AE] text-[var(--ocean-deep)] text-xs font-bold px-3 py-1 rounded-full">
                Most popular
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold" style={{ color: tier.color }}>
                {tier.name}
              </h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold">{tier.price}</span>
                {tier.period && (
                  <span className="text-sm text-[var(--text-muted)]">{tier.period}</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 italic">
                {tier.tagline}
              </p>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
              {tier.description}
            </p>

            <ul className="text-sm space-y-2 mb-6 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-[#2BC2AE] mt-0.5 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span className="text-[var(--text-secondary)]">{f}</span>
                </li>
              ))}
            </ul>

            {/* Simulation */}
            {tier.simulation.monthly !== null ? (
              <div className="glass p-3 rounded-lg mb-4 text-xs">
                <div className="text-[var(--text-muted)] mb-1">With ${tier.simulation.portfolio}:</div>
                <div className="text-[var(--text-primary)] font-mono">
                  ~${tier.simulation.monthly.toFixed(2)}/month
                  <span className="text-[var(--text-muted)]"> ({tier.simulation.label})</span>
                </div>
              </div>
            ) : (
              <div className="glass p-3 rounded-lg mb-4 text-xs">
                <div className="text-[var(--text-muted)] mb-1">Returns depend on your strategy.</div>
                <div className="text-[var(--text-primary)] font-mono">
                  Conservative or aggressive — {tier.simulation.label}.
                </div>
              </div>
            )}

            <Link
              href="/onboarding"
              className={`${tier.highlight ? "bg-gradient-to-r from-[#44E1B4] to-[#2BC2AE] text-[var(--ocean-deep)]" : "glass"} text-center py-2.5 rounded-full text-sm font-medium hover:brightness-110 transition-all`}
            >
              {tier.cta}
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function WhyAISection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="px-6 py-16 max-w-5xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-3 shimmer-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={springEntrance}
      >
        Rules are fast. AI has judgment.
      </motion.h2>
      <motion.p
        className="text-center text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.1 }}
      >
        Navigator uses rules: if signal fires, trade. Captain and Pirate add an AI layer that reads
        news, sentiment, your history, and the full picture before deciding. Rules are the reflexes. AI is the brain.
      </motion.p>

      <div className="space-y-3">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_150px_200px] gap-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          <span>Scenario</span>
          <span>Rules engine</span>
          <span>AI judgment</span>
        </div>

        {judgmentExamples.map((ex, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ ...springEntrance, delay: 0.08 * i }}
            className="glass glass-interactive p-4 sm:grid sm:grid-cols-[1fr_150px_200px] sm:gap-3 sm:items-center space-y-2 sm:space-y-0"
          >
            <p className="text-sm text-[var(--text-primary)]">{ex.scenario}</p>
            <p className="text-sm text-[var(--vela-red)] font-mono">
              <span className="sm:hidden text-[var(--text-muted)] text-xs mr-2">Rules:</span>
              {ex.rules}
            </p>
            <p className="text-sm text-[var(--vela-green)] font-mono">
              <span className="sm:hidden text-[var(--text-muted)] text-xs mr-2">AI:</span>
              {ex.ai}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-8 glass p-5 text-center"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.5 }}
      >
        <p className="text-sm text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">Captain and Pirate</strong> users can also ask the AI anytime:{" "}
          <span className="font-mono text-[var(--vela-blue)]">&quot;How is my strategy doing?&quot;</span>
          <br />
          <span className="text-[var(--text-muted)]">
            The AI reviews your portfolio, win rates per token, and suggests adjustments. Like a financial advisor on demand.
          </span>
        </p>
      </motion.div>
    </section>
  );
}

function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how-it-works" className="px-6 py-16 max-w-3xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-12 shimmer-text"
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
            background: "linear-gradient(180deg, #2BC2AE, transparent)",
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#44E1B4] to-[#2BC2AE] text-[var(--bg-primary)] flex items-center justify-center font-bold text-lg shrink-0">
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

  const actionColors: Record<string, string> = {
    TRIGGER: "var(--vela-gold)",
    AI: "var(--vela-blue)",
    BUY: "var(--vela-green)",
    SELL: "var(--vela-green)",
    HOLD: "var(--text-muted)",
    YIELD: "var(--vela-blue)",
    PROTECT: "var(--vela-red)",
  };

  const borderClass: Record<string, string> = {
    signal: "glass-hold",
    ai: "glass-supply",
    profit: "glass-profit",
    hold: "glass-hold",
    supply: "glass-supply",
    loss: "glass-loss",
  };

  return (
    <section className="px-6 py-16 max-w-4xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-4 shimmer-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={springEntrance}
      >
        Your Agent in Action
      </motion.h2>
      <motion.p
        className="text-center text-[var(--text-secondary)] mb-10 max-w-xl mx-auto"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.1 }}
      >
        Real-time triggers, not scheduled checks. When the market moves, your agent reacts in seconds.
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
            className={`glass glass-interactive p-3 flex items-center gap-4 ${borderClass[entry.type] ?? "glass-hold"}`}
          >
            <span className="text-[var(--text-muted)] w-14 shrink-0 text-right text-xs">{entry.time}</span>
            <span
              className="font-semibold w-18 shrink-0 text-xs"
              style={{ color: actionColors[entry.action] ?? "var(--text-muted)", minWidth: "4.5rem" }}
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

function TreasureSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="px-6 py-16 max-w-3xl mx-auto w-full" ref={ref}>
      <motion.div
        className="glass-liquid p-8 text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={springEntrance}
      >
        <h2 className="text-3xl font-bold mb-3 shimmer-text">The Treasure</h2>
        <p className="text-[var(--text-secondary)] mb-6 max-w-lg mx-auto">
          Every month, a share of subscription revenue goes into the Treasure chest.
          One random ticket wins it all. USDC, straight to your wallet.
        </p>

        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-6">
          <div className="glass p-4 rounded-xl">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Earn tickets by
            </div>
            <div className="text-sm text-[var(--text-primary)] font-medium">
              Referring friends
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              1 ticket per friend who subscribes
            </div>
          </div>
          <div className="glass p-4 rounded-xl">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Earn tickets by
            </div>
            <div className="text-sm text-[var(--text-primary)] font-medium">
              Climbing the leaderboard
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Top 10 strategies earn 1-3 tickets weekly
            </div>
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          Every tier. Every user. Share your performance card, invite friends, compete. The Treasure grows with the community.
        </p>
      </motion.div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features (above tiers)
// ---------------------------------------------------------------------------

const valueProps = [
  {
    title: "Watches the market 24/7",
    description: "Prices update every second. When a signal fires, your agent reacts. Not every 30 minutes. Every second.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    title: "Your keys, your money",
    description: "Self-custodial. Your wallet, your funds. Vela can only act within the limits you set. Revoke access anytime.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
  },
  {
    title: "Zero gas costs",
    description: "Every transaction is gas-free. You pay for the subscription. Vela pays for the rest.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: "See everything",
    description: "Every decision, every reason, every result. Your dashboard shows exactly what the agent is doing and why.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative">
      <OceanBackground />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 sticky top-0 z-50 backdrop-blur-xl bg-[var(--ocean-deep)]/70 border-b border-[var(--liquid-border)]">
        <div className="flex items-center gap-2">
          <Image src="/velalogo-clean.png" alt="Vela" width={24} height={24} />
          <span className="text-lg font-bold shimmer-text">Vela</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="#pricing"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:block"
          >
            Pricing
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:block"
          >
            How it works
          </a>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springEntrance}
          className="relative z-10"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image src="/velalogo-clean.png" alt="Vela" width={72} height={72} className="sm:w-24 sm:h-24" />
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight shimmer-text">
              Vela
            </h1>
          </div>
          <motion.p
            className="text-xl sm:text-2xl text-[var(--text-primary)] mb-2 font-light"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springEntrance, delay: 0.1 }}
          >
            Set sail. Let AI navigate.
          </motion.p>
          <motion.p
            className="text-sm text-[var(--text-secondary)] mb-10 max-w-lg mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springEntrance, delay: 0.2 }}
          >
            Your personal AI agent that grows your money while you sleep.
            It watches the market every second, trades when the numbers make sense,
            and protects you when they don&apos;t. Start free.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springEntrance, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 relative z-10"
        >
          <Link
            href="/onboarding"
            className="glass-liquid px-8 py-3 rounded-full font-medium text-[var(--text-primary)] hover:brightness-110 transition-all duration-300 text-center"
          >
            Start Free
          </Link>
          <a
            href="#pricing"
            className="px-8 py-3 rounded-full font-medium glass text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-all duration-300"
          >
            See Plans
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
              <stop offset="0%" stopColor="#2BC2AE" stopOpacity="0" />
              <stop offset="50%" stopColor="#44E1B4" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#2BC2AE" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Value props */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {valueProps.map((prop, i) => (
            <motion.div
              key={prop.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springEntrance, delay: 0.1 * i }}
              className="glass glass-interactive p-6 group"
            >
              <div className="text-[var(--vela-blue)] mb-3 transition-colors group-hover:text-[var(--vela-gold)]">
                {prop.icon}
              </div>
              <h3 className="text-lg font-semibold mb-1">{prop.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{prop.description}</p>
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
              <stop offset="0%" stopColor="#2BC2AE" stopOpacity="0" />
              <stop offset="50%" stopColor="#44E1B4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#2BC2AE" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Pricing tiers */}
      <TierSection />

      {/* Why AI — judgment layer */}
      <WhyAISection />

      {/* How it works */}
      <HowItWorksSection />

      {/* Agent demo */}
      <DemoSection />

      {/* Treasure */}
      <TreasureSection />

      {/* CTA */}
      <section className="px-6 py-20 text-center relative">
        <motion.h2
          className="text-3xl font-bold mb-4 shimmer-text"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Ready to set sail?
        </motion.h2>
        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
          Start free with Sailor. Earn yield on your USDC today.
          Upgrade to Navigator, Captain, or Pirate whenever you want.
        </p>
        <Link
          href="/onboarding"
          className="glass-liquid inline-block px-10 py-4 rounded-full font-medium text-lg text-[var(--text-primary)] hover:brightness-110 transition-all duration-300"
        >
          Get Started
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-[var(--liquid-border)]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/velalogo-clean.png" alt="Vela" width={20} height={20} />
            <span className="text-sm text-[var(--text-secondary)]">
              Powered by{" "}
              <a
                href="https://chipipay.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-primary)] hover:underline font-medium"
              >
                Chipi Pay
              </a>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#pricing"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Pricing
            </a>
            <a
              href="https://x.com/haycarlitos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @haycarlitos
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
