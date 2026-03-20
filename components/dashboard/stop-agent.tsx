"use client";

import { useState } from "react";

interface StopAgentProps {
  isActive: boolean;
  onStop: () => void;
}

export function StopAgent({ isActive, onStop }: StopAgentProps) {
  const [confirming, setConfirming] = useState(false);

  if (!isActive) return null;

  return (
    <div className="glass p-4 flex items-center justify-between">
      <div>
        <p className="font-medium text-sm">Stop Agent</p>
        <p className="text-xs text-[var(--text-muted)]">Revokes the session key immediately</p>
      </div>
      {confirming ? (
        <div className="flex gap-2">
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
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="px-4 py-2 rounded-lg border border-[var(--vela-red)]/50 text-[var(--vela-red)] text-sm font-medium hover:bg-[var(--vela-red)]/10 transition-all"
        >
          Stop Agent
        </button>
      )}
    </div>
  );
}
