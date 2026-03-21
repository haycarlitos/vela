"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface StopAgentProps {
  isActive: boolean;
  onStop: () => void;
}

export function StopAgent({ isActive, onStop }: StopAgentProps) {
  const [confirming, setConfirming] = useState(false);

  if (!isActive) return null;

  return (
    <div
      className="glass p-4 flex items-center justify-between transition-all duration-300"
      style={confirming ? {
        background: "linear-gradient(135deg, rgba(239, 83, 80, 0.06), var(--liquid-bg))",
        borderColor: "rgba(239, 83, 80, 0.2)",
      } : {}}
    >
      <div className="relative z-10">
        <p className="font-medium text-sm">Stop Agent</p>
        <p className="text-xs text-[var(--text-muted)]">Revokes the session key immediately</p>
      </div>
      <AnimatePresence mode="wait">
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex gap-2"
          >
            <button
              onClick={() => {
                onStop();
                setConfirming(false);
              }}
              className="px-4 py-2 rounded-lg bg-[var(--vela-red)] text-white text-sm font-medium hover:brightness-110 transition-all"
            >
              Confirm Stop
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-4 py-2 rounded-lg glass text-sm font-medium transition-all"
            >
              Cancel
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="stop"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-lg border border-[var(--vela-red)]/50 text-[var(--vela-red)] text-sm font-medium hover:bg-[var(--vela-red)]/10 hover-shake transition-all"
          >
            Stop Agent
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
