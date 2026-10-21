"use client";

import { useState } from "react";
import Link from "next/link";
import { useChipiWallet } from "@chipi-stack/nextjs";
import { motion } from "framer-motion";
import { STRATEGIES, type Strategy } from "@/lib/strategies";
import { authClient, getChipiToken } from "@/lib/auth-client";
import { useHireAgent } from "@/lib/use-hire-agent";

interface ConfigureAgentProps {
  balanceUsd: number;
  /** How often the agent decides, in words ("every hour"). */
  tickEvery: string;
  onHired: () => void;
}

export function ConfigureAgent({ balanceUsd, tickEvery, onHired }: ConfigureAgentProps) {
  const userId = authClient.useSession().data?.user.id;
  const [strategy, setStrategy] = useState<Strategy>("balanced");
  const [maxTradeUsd, setMaxTradeUsd] = useState(Math.max(1, Math.min(5, Math.floor(balanceUsd / 4))));
  const [status, setStatus] = useState("");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True from the click until the hire is confirmed or fails: one hire at a time.
  const [hiring, setHiring] = useState(false);

  const { wallet } = useChipiWallet({ externalUserId: userId ?? null, getBearerToken: getChipiToken });
  const { hire, supportsSession, isRegistering } = useHireAgent(wallet);

  const handleHire = async () => {
    if (hiring) return;
    setHiring(true);
    setError(null);
    try {
      await hire(strategy, maxTradeUsd, setStatus);
      setStatus("Your agent is sailing.");
      onHired();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hire the agent");
      setStatus("");
      setHiring(false);
    }
  };

  if (wallet && !supportsSession) {
    return <p className="text-[var(--vela-red)]">This wallet can&apos;t use an agent.</p>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-8 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Hire your agent</h2>

      <div className="mb-6">
        <label className="text-sm font-medium text-[var(--text-secondary)] mb-3 block">Strategy</label>
        <div className="space-y-2">
          {(Object.keys(STRATEGIES) as Strategy[]).map((key) => {
            const selected = strategy === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => setStrategy(key)}
                disabled={hiring}
                // Inline style: .glass sets its own border and background, which win over utility classes.
                style={selected ? { borderColor: "var(--vela-blue)", boxShadow: "0 0 0 1px var(--vela-blue)" } : undefined}
                className="w-full glass p-3 text-left transition-all flex items-start gap-3 disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                    selected ? "border-[var(--vela-blue)] bg-[var(--vela-blue)]" : "border-[var(--text-muted)]"
                  }`}
                />
                <span>
                  <span className={`block font-medium text-sm ${selected ? "text-[var(--vela-blue)]" : ""}`}>
                    {STRATEGIES[key].label}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">{STRATEGIES[key].description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Max per trade ($)</label>
        <input
          type="number"
          value={maxTradeUsd}
          onChange={(e) => setMaxTradeUsd(Number(e.target.value))}
          min={0.5}
          max={50}
          step={0.5}
          className="w-full glass p-3 bg-transparent outline-none text-sm font-mono"
        />
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Enforced by your wallet contract: at most ${maxTradeUsd} per trade and ${maxTradeUsd * 4} per day, for 7 days.
        </p>
      </div>

      <div className="glass p-4 mb-6 space-y-1 text-sm text-[var(--text-secondary)]">
        <p>Your agent will:</p>
        <ul className="space-y-1">
          <li>Check the market {tickEvery}</li>
          {strategy !== "conservative" && <li>Trade on AVNU when the signal is strong</li>}
          <li>Earn yield on Vesu</li>
          <li>Never hold your key: you can stop it any time</li>
        </ul>
      </div>

      <label className="flex items-start gap-3 mb-6 text-sm text-[var(--text-secondary)] cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedRisk}
          onChange={(e) => setAcceptedRisk(e.target.checked)}
          className="mt-1 accent-[var(--vela-blue)]"
        />
        <span>
          I understand the agent can lose money within these caps, and that Vela is a beta, not financial advice.{" "}
          <Link href="/terms" target="_blank" className="underline text-[var(--vela-blue)]">
            Terms
          </Link>
        </span>
      </label>

      {status && <p className="text-sm text-[var(--vela-blue)] text-center mb-4">{status}</p>}

      <button
        onClick={handleHire}
        disabled={hiring || isRegistering || !wallet || !acceptedRisk || !(maxTradeUsd >= 0.5)}
        className="w-full py-4 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-semibold text-lg hover:brightness-110 transition-all disabled:opacity-50"
      >
        {isRegistering ? "Waiting for your passkey…" : hiring ? "Hiring…" : "Hire agent"}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--vela-red)] text-center">{error}</p>}
    </motion.div>
  );
}
