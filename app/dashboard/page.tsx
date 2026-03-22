"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PnlChart } from "@/components/dashboard/pnl-chart";
import { StopAgent } from "@/components/dashboard/stop-agent";
import { PortfolioCard } from "@/components/dashboard/portfolio-card";
import { TreasureCard } from "@/components/dashboard/treasure-card";
import { LeaderboardCard } from "@/components/dashboard/leaderboard-card";
import { AskAI } from "@/components/dashboard/ask-ai";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { OceanBackground } from "@/components/ocean-background";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  type Tier,
  type TabId,
  TIER_LABELS,
  TIER_COLORS,
  TIER_TABS,
  TIER_FEATURES,
  DEMO_DATA_BY_TIER,
  TREASURE_BY_TIER,
  ASK_AI_CONVERSATIONS,
  getLeaderboardData,
} from "@/lib/demo-data";

const spring = { type: "spring" as const, stiffness: 120, damping: 20 };

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const tierParam = searchParams.get("tier");
  const tier: Tier = (["sailor", "navigator", "captain", "pirate"].includes(tierParam || "") ? tierParam : "captain") as Tier;

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const tabs = TIER_TABS[tier];
  const data = DEMO_DATA_BY_TIER[tier];
  const features = TIER_FEATURES[tier];
  const treasure = TREASURE_BY_TIER[tier];
  const leaderboard = getLeaderboardData(tier);
  const conversation = ASK_AI_CONVERSATIONS[tier];

  return (
    <div className="min-h-screen flex flex-col relative">
      <OceanBackground />

      {/* Header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          background: "color-mix(in srgb, var(--ocean-deep) 80%, transparent)",
          borderBottom: "1px solid var(--liquid-border)",
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <Image src="/velalogo-clean.png" alt="Vela" width={24} height={24} />
          <span className="text-xl font-bold shimmer-text">Vela</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--text-muted)] hidden sm:block">
            0x04a1...f0a1
          </span>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: `color-mix(in srgb, ${TIER_COLORS[tier]} 20%, transparent)`,
              color: TIER_COLORS[tier],
            }}
          >
            {TIER_LABELS[tier]}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="px-4 sm:px-6 pt-4 max-w-6xl mx-auto w-full" role="tablist" aria-label="Dashboard sections">
        <div className="flex gap-1 glass p-1.5 rounded-full w-fit overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] outline-none ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-[#44E1B4] to-[#2BC2AE] text-[var(--ocean-deep)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {activeTab === "overview" && (
              <>
                <AnimatedSection>
                  <AgentStatus
                    totalValueUsd={data.portfolio.totalValueUsd}
                    pnlUsd={data.pnl.usd}
                    pnlPct={data.pnl.pct}
                    winRate={data.stats.winRate}
                    totalDecisions={data.stats.totalDecisions}
                    totalX402Spent={data.stats.totalX402Spent}
                    sessionRemaining="5d 14h"
                    isActive={true}
                  />
                </AnimatedSection>

                <AnimatedSection delay={0.1}>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <PnlChart snapshots={data.snapshots} />
                    </div>
                    <PortfolioCard portfolio={data.portfolio} />
                  </div>
                </AnimatedSection>

                <AnimatedSection delay={0.15}>
                  <ActivityFeed decisions={data.decisions} />
                </AnimatedSection>

                {/* Ask AI (shown in overview for Captain+, upgrade prompt for others) */}
                <AnimatedSection delay={0.2}>
                  <AskAI tier={tier} conversation={conversation} />
                </AnimatedSection>

                <AnimatedSection delay={0.25}>
                  <StopAgent
                    isActive={true}
                    onStop={() => {}}
                  />
                </AnimatedSection>
              </>
            )}

            {activeTab === "leaderboard" && (
              <AnimatedSection>
                <LeaderboardCard tier={tier} entries={leaderboard} />
              </AnimatedSection>
            )}

            {activeTab === "treasure" && (
              <AnimatedSection>
                <TreasureCard tier={tier} data={treasure} />
              </AnimatedSection>
            )}

            {activeTab === "strategy" && features.customStrategy && (
              <AnimatedSection>
                <SettingsPanel tier={tier} />
              </AnimatedSection>
            )}

            {activeTab === "settings" && (
              <AnimatedSection>
                <SettingsPanel tier={tier} />
              </AnimatedSection>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="shimmer-text text-lg font-bold">Loading...</span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
