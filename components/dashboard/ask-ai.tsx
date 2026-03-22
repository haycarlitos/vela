"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { Tier, AIChatMessage } from "@/lib/demo-data";
import { TIER_FEATURES } from "@/lib/demo-data";

interface AskAIProps {
  tier: Tier;
  conversation: AIChatMessage[];
}

const spring = { type: "spring" as const, stiffness: 120, damping: 20 };

export function AskAI({ tier, conversation }: AskAIProps) {
  const [input, setInput] = useState("");
  const hasAccess = TIER_FEATURES[tier].askAI;

  // Upgrade prompt for tiers without AI access
  if (!hasAccess) {
    return (
      <div className="glass p-6 text-center">
        <div className="relative z-10 space-y-3">
          <h3 className="text-lg font-semibold shimmer-text inline-block">Ask AI</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            AI portfolio advice is available on Captain ($3/mo) and Pirate ($5/mo).
          </p>
          <Link
            href="/#pricing"
            className="inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-[#44E1B4] to-[#2BC2AE] text-[var(--ocean-deep)] text-sm font-medium hover:brightness-110 transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] outline-none"
          >
            Upgrade
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-lg font-semibold shimmer-text inline-block">Ask AI</h3>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: "color-mix(in srgb, #44E1B4 20%, transparent)",
            color: "#44E1B4",
          }}
        >
          Captain & Pirate
        </span>
      </div>

      {/* Conversation */}
      <div className="space-y-3 mb-4 relative z-10">
        {conversation.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 * i }}
            className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`glass p-3 max-w-[85%] sm:max-w-[75%] ${
                msg.role === "user"
                  ? "rounded-2xl rounded-br-sm"
                  : "rounded-2xl rounded-bl-sm border-l-2 border-[#2BC2AE]"
              }`}
            >
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{msg.message}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 relative z-10">
        <input
          type="text"
          placeholder="Ask about your portfolio..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-full glass bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] min-h-[44px]"
        />
        <button
          onClick={() => setInput("")}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[#44E1B4] to-[#2BC2AE] flex items-center justify-center shrink-0 hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-[var(--vela-blue)] outline-none"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ocean-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
