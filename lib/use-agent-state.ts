"use client";

import { useCallback, useEffect, useState } from "react";

/** Shape of GET /api/agents (see app/api/agents/route.ts). */
export interface AgentState {
  wallet: { address: string; walletType?: string } | null;
  portfolio?: {
    USDC: { balance: number; usd: number };
    ETH: { balance: number; usd: number };
    STRK: { balance: number; usd: number };
    vesuUsd: number;
  };
  prices?: { USDC: number; ETH: number; STRK: number };
  totalUsd?: number;
  depositCapUsd?: number;
  agent?: { strategy: string; maxTradeUsd: number; sessionPublicKey: string; active: boolean } | null;
  session?: { isActive: boolean; validUntil: number; remainingCalls: number } | null;
  decisions?: Array<{
    id: number;
    createdAt: string;
    kind: string;
    fromToken: string | null;
    toToken: string | null;
    amountUsd: number | null;
    reason: string;
    txHash: string | null;
    success: boolean | null;
    aiCostUsd: number | null;
  }>;
}

async function fetchAgentState(): Promise<AgentState> {
  const res = await fetch("/api/agents", { cache: "no-store" });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
  return (await res.json()) as AgentState;
}

/** Polls the signed-in user's wallet, portfolio and agent. Waits while `enabled` is false (signed out). */
export function useAgentState(intervalMs = 20_000, enabled = true) {
  const [state, setState] = useState<AgentState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await fetchAgentState());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      fetchAgentState()
        .then((next) => {
          if (!cancelled) {
            setState(next);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    void load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs, enabled]);

  return { state, error, refresh };
}
