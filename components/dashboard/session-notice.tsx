"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChipiWalletData } from "@chipi-stack/nextjs";
import { formatDate, type SessionNotice as Notice } from "@/lib/notices";
import { STRATEGIES, isStrategy } from "@/lib/strategies";
import { useHireAgent } from "@/lib/use-hire-agent";

interface SessionNoticeProps {
  notice: Notice;
  agent: { strategy: string; maxTradeUsd: number };
  wallet: ChipiWalletData | null;
  onRenewed: () => Promise<void> | void;
}

function message(notice: Notice): string {
  switch (notice.kind) {
    case "ending":
      return `Your agent's session ends ${formatDate(notice.endsAt)}. Then it stops until you renew it here.`;
    case "expired":
      return `Your agent stopped on ${formatDate(notice.endedAt)}: its session ended.`;
    case "out-of-calls":
      return "Your agent stopped: its session used every call it allowed.";
    case "stopped":
      return "Your agent is stopped.";
  }
}

/**
 * Why the agent stopped (or is about to), and a renew button: a new session
 * with the same strategy and cap, one passkey prompt. Renewing replaces the
 * stored session key, so it's offered only once the agent has stopped.
 */
export function SessionNotice({ notice, agent, wallet, onRenewed }: SessionNoticeProps) {
  const { hire, isRegistering } = useHireAgent(wallet);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const strategy = isStrategy(agent.strategy) ? agent.strategy : null;

  const renew = async () => {
    if (!strategy || busy) return;
    setBusy(true);
    setError(null);
    try {
      await hire(strategy, agent.maxTradeUsd, setStatus);
      setStatus("");
      await onRenewed();
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : "Couldn't renew the agent");
    } finally {
      setBusy(false);
    }
  };

  const stopped = notice.kind !== "ending";
  return (
    <div className={`glass p-4 space-y-3 ${stopped ? "border border-[var(--vela-gold)]" : ""}`}>
      <p className="text-sm">{message(notice)}</p>
      {stopped && (
        <div className="flex flex-wrap items-center gap-4">
          {strategy && (
            <button
              onClick={renew}
              disabled={busy || isRegistering || !wallet}
              className="px-4 py-2 rounded-lg bg-[var(--vela-blue)] text-white font-medium disabled:opacity-50"
            >
              {busy ? "Renewing…" : `Renew: ${STRATEGIES[strategy].label}, up to $${agent.maxTradeUsd} a trade`}
            </button>
          )}
          <Link href="/onboarding" className="text-sm text-[var(--vela-blue)] hover:underline">
            Change settings
          </Link>
        </div>
      )}
      {status && <p className="text-sm text-[var(--vela-blue)]">{status}</p>}
      {error && <p className="text-sm text-[var(--vela-red)]">{error}</p>}
    </div>
  );
}
