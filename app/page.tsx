"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { OceanBackground } from "@/components/ocean-background";
import { ThemeToggle } from "@/components/theme-toggle";

const spring = { type: "spring" as const, stiffness: 120, damping: 20 };

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const tiers = [
  {
    name: "Sailor",
    slug: "sailor",
    price: "Free",
    one: "Your money earns interest.",
    features: ["Automatic yield on USDC", "Always picks the best rate", "Zero effort"],
    cta: "Start Free",
    highlight: false,
    color: "var(--vela-blue)",
  },
  {
    name: "Navigator",
    slug: "navigator",
    price: "$1",
    period: "/mo",
    one: "A robot that trades for you.",
    features: ["Buys dips, sells rallies", "Reacts in seconds", "Up to 5 trades/day"],
    cta: "Start for $1",
    highlight: false,
    color: "var(--vela-green)",
  },
  {
    name: "Captain",
    slug: "captain",
    price: "$3",
    period: "/mo",
    one: "AI that thinks before trading.",
    features: ["Reads news and sentiment", "Protects you when things drop", "Ask: \"How am I doing?\""],
    cta: "Start for $3",
    highlight: true,
    color: "#44E1B4",
  },
  {
    name: "Pirate",
    slug: "pirate",
    price: "$5",
    period: "/mo",
    one: "You set the rules.",
    features: ["Custom strategy", "Compete on the leaderboard", "Unlimited AI advice"],
    cta: "Start for $5",
    highlight: false,
    color: "var(--vela-gold)",
  },
];

const whyAI = [
  {
    without: "You already own too much ETH. Robot buys more anyway.",
    with: "\"You're 60% ETH. Too concentrated. Skipping.\"",
  },
  {
    without: "Your last 5 STRK trades lost money. Robot buys again.",
    with: "\"STRK strategy is failing. Stopping it.\"",
  },
  {
    without: "Big news drops. Robot doesn't read the news.",
    with: "\"Starknet just got a $100M grant. Buying STRK.\"",
  },
  {
    without: "Market looks weak but signal says buy. Robot buys.",
    with: "\"Signal is weak. Volume dying. Waiting.\"",
  },
];

const demoEntries = [
  { time: "now", action: "BUY", detail: "ETH dipped 6%. Bought $15.", color: "var(--vela-green)", border: "glass-profit" },
  { time: "18m", action: "SKIP", detail: "Signal fired on STRK, but AI said: \"Not worth it.\"", color: "var(--text-muted)", border: "glass-hold" },
  { time: "1h", action: "MOVE", detail: "Better rate found. Moved USDC for +2.7% more yield.", color: "var(--vela-blue)", border: "glass-supply" },
  { time: "3h", action: "SELL", detail: "ETH up 6% from entry. Locked $1.80 gain.", color: "var(--vela-green)", border: "glass-profit" },
  { time: "5h", action: "PROTECT", detail: "STRK dropped 4%. Sold early. Lost $0.30 instead of $2.", color: "var(--vela-red)", border: "glass-loss" },
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
        className="text-3xl font-bold text-center mb-10 shimmer-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={spring}
      >
        Pick your style
      </motion.h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ ...spring, delay: 0.08 * i }}
            className={`glass glass-interactive p-6 flex flex-col relative ${tier.highlight ? "border border-[#2BC2AE]/40" : ""}`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#44E1B4] to-[#2BC2AE] text-[var(--ocean-deep)] text-xs font-bold px-3 py-1 rounded-full">
                Most popular
              </div>
            )}

            <h3 className="text-lg font-bold" style={{ color: tier.color }}>{tier.name}</h3>
            <div className="flex items-baseline gap-1 mt-1 mb-3">
              <span className="text-3xl font-bold">{tier.price}</span>
              {tier.period && <span className="text-sm text-[var(--text-muted)]">{tier.period}</span>}
            </div>

            <p className="text-sm text-[var(--text-primary)] mb-5 font-medium leading-snug">
              {tier.one}
            </p>

            <ul className="text-sm space-y-2.5 mb-6 flex-1">
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

            <Link
              href={`/demo?tier=${tier.slug}`}
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
    <section className="px-6 py-16 max-w-4xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-3 shimmer-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={spring}
      >
        Why AI?
      </motion.h2>
      <motion.p
        className="text-center text-[var(--text-secondary)] mb-8 text-sm"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.1 }}
      >
        Bots follow rules blindly. AI thinks before acting.
      </motion.p>

      <div className="space-y-3">
        {whyAI.map((ex, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ ...spring, delay: 0.08 * i }}
            className="glass p-4 grid sm:grid-cols-2 gap-3"
          >
            <div className="flex items-start gap-2">
              <span className="text-[var(--vela-red)] shrink-0 mt-0.5 text-xs font-bold">BOT</span>
              <p className="text-sm text-[var(--text-muted)]">{ex.without}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--vela-green)] shrink-0 mt-0.5 text-xs font-bold">AI</span>
              <p className="text-sm text-[var(--text-primary)] font-medium">{ex.with}</p>
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
    <section className="px-6 py-16 max-w-3xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-8 shimmer-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={spring}
      >
        A typical day
      </motion.h2>
      <div className="space-y-3 font-mono text-sm">
        {demoEntries.map((entry, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.08 * i }}
            className={`glass p-3 flex items-center gap-3 ${entry.border}`}
          >
            <span className="text-[var(--text-muted)] w-10 shrink-0 text-right text-xs">{entry.time}</span>
            <span className="font-bold text-xs shrink-0" style={{ color: entry.color, minWidth: "4rem" }}>
              {entry.action}
            </span>
            <span className="text-[var(--text-secondary)] text-xs">{entry.detail}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SocialProofBar() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section className="px-6 py-8 max-w-3xl mx-auto w-full" ref={ref}>
      <motion.div
        className="flex flex-wrap items-center justify-center gap-6 sm:gap-10"
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={spring}
      >
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--text-secondary)]">
            <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" />
          </svg>
          <span>Built on Starknet</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-[var(--text-muted)] hidden sm:block" />
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
          <span>Powered by</span>
          <a href="https://chipipay.com" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] font-medium hover:underline">
            Chipi Pay
          </a>
        </div>
        <div className="w-1 h-1 rounded-full bg-[var(--text-muted)] hidden sm:block" />
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--text-muted)]">
            <span className="font-mono font-bold text-[var(--text-primary)]">47</span> agents active
          </span>
          <span className="text-[var(--text-muted)]">
            <span className="font-mono font-bold text-[var(--text-primary)]">1,283</span> decisions made
          </span>
        </div>
      </motion.div>
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
        transition={spring}
      >
        <h2 className="text-3xl font-bold mb-2 shimmer-text">The Treasure</h2>
        <p className="text-lg text-[var(--text-primary)] mb-1">
          Every month. One winner. Real money.
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          Every tier competes. Free users included.
        </p>

        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-6">
          <div className="glass p-3 rounded-xl">
            <div className="text-sm font-bold text-[var(--text-primary)] mb-1">Invite a friend</div>
            <div className="text-xs text-[var(--text-secondary)]">1 ticket per referral</div>
          </div>
          <div className="glass p-3 rounded-xl">
            <div className="text-sm font-bold text-[var(--text-primary)] mb-1">Weekly top 5</div>
            <div className="text-xs text-[var(--text-secondary)]">1-5 tickets per week</div>
          </div>
          <div className="glass p-3 rounded-xl">
            <div className="text-sm font-bold text-[var(--vela-gold)] mb-1">Pirate tier</div>
            <div className="text-xs text-[var(--text-secondary)]">2x referral tickets</div>
          </div>
        </div>

        <div className="glass p-4 rounded-xl max-w-sm mx-auto">
          <p className="text-xs text-[var(--text-muted)] mb-2">Your referral link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm text-[var(--text-primary)] truncate">
              vela.app/r/yourname
            </code>
            <button
              className="shrink-0 px-3 py-1.5 rounded-lg glass text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-all"
              onClick={() => {}}
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">Share to earn tickets</p>
        </div>
      </motion.div>
    </section>
  );
}

function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const steps = [
    { n: "1", title: "Create wallet", sub: "Fingerprint. 10 seconds." },
    { n: "2", title: "Add USDC", sub: "Start with $5." },
    { n: "3", title: "Pick a plan", sub: "Free to $5/mo." },
    { n: "4", title: "Watch it work", sub: "Every decision explained." },
  ];

  return (
    <section id="how-it-works" className="px-6 py-16 max-w-2xl mx-auto w-full" ref={ref}>
      <motion.h2
        className="text-3xl font-bold text-center mb-10 shimmer-text"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={spring}
      >
        4 steps. 1 minute.
      </motion.h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ ...spring, delay: 0.1 * i }}
            className="glass p-4 text-center"
          >
            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gradient-to-br from-[#44E1B4] to-[#2BC2AE] text-[var(--bg-primary)] flex items-center justify-center font-bold text-sm">
              {s.n}
            </div>
            <div className="font-semibold text-sm">{s.title}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">{s.sub}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

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
          <a href="#how-it-works" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:block">
            How It Works
          </a>
          <a href="#pricing" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:block">
            Pricing
          </a>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center relative">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="relative z-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image src="/velalogo-clean.png" alt="Vela" width={72} height={72} className="sm:w-24 sm:h-24" />
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight shimmer-text">Vela</h1>
          </div>
          <motion.p
            className="text-xl sm:text-2xl text-[var(--text-primary)] mb-2 font-light"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
          >
            Your money works while you sleep.
          </motion.p>
          <motion.p
            className="text-sm text-[var(--text-secondary)] mb-10 max-w-md mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
          >
            AI agent that earns yield, catches dips, and protects your portfolio. 24/7. Start free.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.3 }}
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

      {/* Social proof */}
      <SocialProofBar />

      {/* How it works */}
      <HowItWorksSection />

      {/* Why AI */}
      <WhyAISection />

      {/* Demo */}
      <DemoSection />

      {/* Tiers */}
      <TierSection />

      {/* Treasure */}
      <TreasureSection />

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <motion.h2
          className="text-3xl font-bold mb-3 shimmer-text"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Ready?
        </motion.h2>
        <p className="text-[var(--text-secondary)] mb-8">Start free. Upgrade anytime.</p>
        <Link
          href="/onboarding"
          className="glass-liquid inline-block px-10 py-4 rounded-full font-medium text-lg text-[var(--text-primary)] hover:brightness-110 transition-all duration-300"
        >
          Start Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[var(--liquid-border)]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/velalogo-clean.png" alt="Vela" width={20} height={20} />
            <span className="text-sm text-[var(--text-secondary)]">
              Powered by{" "}
              <a href="https://chipipay.com" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] hover:underline font-medium">
                Chipi Pay
              </a>
            </span>
          </div>
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
      </footer>
    </div>
  );
}
