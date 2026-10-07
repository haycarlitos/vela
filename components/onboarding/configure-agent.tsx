"use client";

import { useState } from "react";
import Link from "next/link";
import { getWalletEncryptKey, useChipiSession, useChipiWallet } from "@chipi-stack/nextjs";
import { motion } from "framer-motion";
import { STRATEGIES, type Strategy } from "@/lib/strategies";
import { authClient, getChipiToken } from "@/lib/auth-client";

interface ConfigureAgentProps {
  balanceUsd: number;
  /** How often the agent decides, in words ("every hour"). */
  tickEvery: string;
  onHired: () => void;
}

interface HireResponse {
  sessionPublicKey: string;
  validUntil: number;
  maxCalls: number;
  allowedEntrypoints: string[];
  spendingPolicies: Array<{ token: string; maxPerCall: string; maxPerWindow: string; windowSeconds: number }>;
  error?: string;
}

export function ConfigureAgent({ balanceUsd, tickEvery, onHired }: ConfigureAgentProps) {
  const userId = authClient.useSession().data?.user.id;
  const [strategy, setStrategy] = useState<Strategy>("balanced");
  const [maxTradeUsd, setMaxTradeUsd] = useState(Math.max(1, Math.min(5, Math.floor(balanceUsd / 4))));
  const [status, setStatus] = useState("");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { wallet } = useChipiWallet({ externalUserId: userId ?? null, getBearerToken: getChipiToken });
  const { registerSession, supportsSession, isRegistering } = useChipiSession({
    wallet,
    // The passkey prompt appears only when the user hires the agent. The
    // credential id comes from the wallet, so this works on any device.
    getEncryptKey: () =>
      getWalletEncryptKey(wallet?.credentialId ?? undefined, { prfSupported: wallet?.prfSupported ?? undefined }),
    getBearerToken: getChipiToken,
    autoCheckStatus: false,
  });

  const handleHire = async () => {
    setError(null);
    try {
      // 1. Vela's server creates the session key and keeps the private half.
      setStatus("Preparing your agent's key…");
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, maxTradeUsd }),
      });
      const hire = (await res.json()) as HireResponse;
      if (!res.ok) throw new Error(hire.error ?? `HTTP ${res.status}`);

      // 2. One passkey prompt: the session and its caps, in one transaction.
      setStatus("Confirm with your passkey…");
      const txHash = await registerSession({
        sessionPublicKey: hire.sessionPublicKey,
        validUntil: hire.validUntil,
        maxCalls: hire.maxCalls,
        allowedEntrypoints: hire.allowedEntrypoints,
        spendingPolicies: hire.spendingPolicies.map((p) => ({
          token: p.token,
          maxPerCall: BigInt(p.maxPerCall),
          maxPerWindow: BigInt(p.maxPerWindow),
          windowSeconds: p.windowSeconds,
        })),
      });

      // 3. Vela checks the chain before the agent starts.
      setStatus("Waiting for Starknet…");
      const confirm = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionPublicKey: hire.sessionPublicKey, txHash, active: true }),
      });
      if (!confirm.ok) {
        throw new Error(((await confirm.json()) as { error?: string }).error ?? `HTTP ${confirm.status}`);
      }

      setStatus("Your agent is sailing.");
      onHired();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hire the agent");
      setStatus("");
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
          {(Object.keys(STRATEGIES) as Strategy[]).map((key) => (
            <button
              key={key}
              onClick={() => setStrategy(key)}
              className={`w-full glass p-3 text-left transition-all ${
                strategy === key ? "border-[var(--vela-blue)] bg-[var(--vela-blue)]/10" : ""
              }`}
            >
              <p className="font-medium text-sm">{STRATEGIES[key].label}</p>
              <p className="text-xs text-[var(--text-muted)]">{STRATEGIES[key].description}</p>
            </button>
          ))}
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
        disabled={isRegistering || !wallet || !acceptedRisk || !(maxTradeUsd >= 0.5)}
        className="w-full py-4 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-semibold text-lg hover:brightness-110 transition-all disabled:opacity-50"
      >
        {isRegistering ? "Waiting for your passkey…" : "Hire agent"}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--vela-red)] text-center">{error}</p>}
    </motion.div>
  );
}
