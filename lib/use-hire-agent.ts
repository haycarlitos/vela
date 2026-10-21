"use client";

import { useCallback } from "react";
import { getWalletEncryptKey, useChipiSession, type ChipiWalletData } from "@chipi-stack/nextjs";
import { getChipiToken } from "@/lib/auth-client";
import type { Strategy } from "@/lib/strategies";

interface HireResponse {
  sessionPublicKey: string;
  validUntil: number;
  maxCalls: number;
  allowedEntrypoints: string[];
  spendingPolicies: Array<{ token: string; maxPerCall: string; maxPerWindow: string; windowSeconds: number }>;
  error?: string;
}

/**
 * Hires the agent: a new session key with its caps, registered with one
 * passkey prompt and checked on-chain by the server. Renewing is hiring again.
 */
export function useHireAgent(wallet: ChipiWalletData | null | undefined) {
  const { registerSession, supportsSession, isRegistering } = useChipiSession({
    wallet,
    // The passkey prompt appears only when the user hires the agent. The
    // credential id comes from the wallet, so this works on any device.
    getEncryptKey: () =>
      getWalletEncryptKey(wallet?.credentialId ?? undefined, { prfSupported: wallet?.prfSupported ?? undefined }),
    getBearerToken: getChipiToken,
    autoCheckStatus: false,
  });

  const hire = useCallback(
    async (strategy: Strategy, maxTradeUsd: number, onStatus: (status: string) => void = () => {}) => {
      // 1. Vela's server creates the session key and keeps the private half.
      onStatus("Preparing your agent's key…");
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, maxTradeUsd }),
      });
      const session = (await res.json()) as HireResponse;
      if (!res.ok) throw new Error(session.error ?? `HTTP ${res.status}`);

      // 2. One passkey prompt: the session and its caps, in one transaction.
      onStatus("Confirm with your passkey…");
      const txHash = await registerSession({
        sessionPublicKey: session.sessionPublicKey,
        validUntil: session.validUntil,
        maxCalls: session.maxCalls,
        allowedEntrypoints: session.allowedEntrypoints,
        spendingPolicies: session.spendingPolicies.map((p) => ({
          token: p.token,
          maxPerCall: BigInt(p.maxPerCall),
          maxPerWindow: BigInt(p.maxPerWindow),
          windowSeconds: p.windowSeconds,
        })),
      });

      // 3. Vela checks the chain before the agent starts.
      onStatus("Waiting for Starknet…");
      const confirm = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionPublicKey: session.sessionPublicKey, txHash, active: true }),
      });
      if (!confirm.ok) {
        throw new Error(((await confirm.json()) as { error?: string }).error ?? `HTTP ${confirm.status}`);
      }
    },
    [registerSession]
  );

  return { hire, supportsSession, isRegistering };
}
