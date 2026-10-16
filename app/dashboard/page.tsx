"use client";

import { useState } from "react";
import Link from "next/link";
import { getWalletEncryptKey, useChipiSession, useChipiWallet } from "@chipi-stack/nextjs";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { SignOutButton } from "@/components/sign-out-button";
import { TrustedWallets } from "@/components/dashboard/trusted-wallets";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PortfolioCard } from "@/components/dashboard/portfolio-card";
import { StopAgent } from "@/components/dashboard/stop-agent";
import { LinkedWallet } from "@/components/dashboard/linked-wallet";
import { useAgentState, type AgentState } from "@/lib/use-agent-state";
import { authClient, getChipiToken } from "@/lib/auth-client";

const ACTION_NAMES: Record<string, string> = { supply: "supply_vesu", withdraw: "withdraw_vesu" };

function feed(decisions: NonNullable<AgentState["decisions"]>) {
  return decisions.map((d) => ({
    id: d.id,
    createdAt: d.createdAt,
    action: ACTION_NAMES[d.kind] ?? d.kind,
    pair: d.fromToken && d.toToken ? `${d.fromToken} → ${d.toToken}` : null,
    amountUsd: d.amountUsd,
    reasoning: d.reason,
    txHash: d.txHash,
    outcome: d.success === false ? "failed" : "open",
  }));
}

function timeLeft(validUntil: number): string {
  const seconds = validUntil - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return "expired";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const { state, error, refresh } = useAgentState(20_000, Boolean(userId));
  const [stopError, setStopError] = useState<string | null>(null);

  const { wallet } = useChipiWallet({ externalUserId: userId ?? null, getBearerToken: getChipiToken });
  const { revokeSession } = useChipiSession({
    wallet,
    getEncryptKey: () =>
      getWalletEncryptKey(wallet?.credentialId ?? undefined, { prfSupported: wallet?.prfSupported ?? undefined }),
    getBearerToken: getChipiToken,
    autoCheckStatus: false,
  });

  if (!isPending && !userId) {
    return (
      <Centered>
        <Link href="/onboarding" className="text-[var(--vela-blue)] hover:underline">
          Sign in
        </Link>
      </Centered>
    );
  }
  if (error) return <Centered>{error}</Centered>;
  if (!state) return <Centered>Loading…</Centered>;
  if (!state.wallet || !state.agent) {
    return (
      <Centered>
        <Link href="/onboarding" className="text-[var(--vela-blue)] hover:underline">
          Hire your agent
        </Link>
      </Centered>
    );
  }

  const agent = state.agent;
  const active = agent.active && Boolean(state.session?.isActive);
  const decisions = state.decisions ?? [];
  const aiCostUsd = decisions.reduce((sum, d) => sum + (d.aiCostUsd ?? 0), 0);

  const stop = async () => {
    setStopError(null);
    try {
      // One passkey prompt. The browser never held the session: pass its key.
      const txHash = await revokeSession(agent.sessionPublicKey);
      await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionPublicKey: agent.sessionPublicKey, txHash, active: false }),
      });
      await refresh();
    } catch (err) {
      setStopError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold gradient-text">
          Vela
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {state.wallet.address.slice(0, 10)}…{state.wallet.address.slice(-6)}
          </span>
          <SignOutButton />
        </div>
      </header>

      <AgentStatus
        totalValueUsd={state.totalUsd ?? 0}
        totalDecisions={decisions.length}
        aiCostUsd={aiCostUsd}
        sessionRemaining={
          active && state.session
            ? `${timeLeft(state.session.validUntil)} · ${state.session.remainingCalls} calls`
            : undefined
        }
        isActive={active}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {state.portfolio && <PortfolioCard portfolio={{ ...state.portfolio, totalValueUsd: state.totalUsd ?? 0, usdc: state.portfolio.USDC, eth: { ...state.portfolio.ETH, price: state.prices?.ETH ?? 0 }, strk: { ...state.portfolio.STRK, price: state.prices?.STRK ?? 0 }, vesuDeposited: state.portfolio.vesuUsd }} />}
        <div className="space-y-4">
          <StopAgent isActive={active} onStop={stop} />
          {stopError && <p className="text-sm text-[var(--vela-red)]">{stopError}</p>}
          {!active && (
            <Link href="/onboarding" className="block glass p-4 text-center text-[var(--vela-blue)]">
              {agent.active ? "Session ended. Hire again" : "Hire your agent again"}
            </Link>
          )}
          <LinkedWallet
            linkedWallet={state.linkedWallet ?? null}
            wallet={wallet ?? null}
            liquidUsdc={state.portfolio?.USDC.balance ?? 0}
            onChanged={refresh}
          />
          <TrustedWallets wallet={wallet ?? null} />
        </div>
      </div>

      <ActivityFeed decisions={feed(decisions)} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-[var(--text-secondary)]">{children}</div>;
}
