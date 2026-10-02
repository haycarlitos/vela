"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreateAccount } from "@/components/onboarding/create-account";
import { CreateWallet } from "@/components/onboarding/create-wallet";
import { FundWallet } from "@/components/onboarding/fund-wallet";
import { ConfigureAgent } from "@/components/onboarding/configure-agent";
import { useAgentState } from "@/lib/use-agent-state";
import { isFunded } from "@/lib/config";
import { authClient } from "@/lib/auth-client";

const STEPS = ["Account", "Wallet", "Fund", "Hire"] as const;

export default function OnboardingClient() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const { state, error, refresh } = useAgentState(15_000, Boolean(userId));

  const step = !userId ? 0 : !state?.wallet ? 1 : !isFunded(state.totalUsd ?? 0) ? 2 : 3;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
        <Link href="/" className="text-xl font-bold gradient-text">
          Vela
        </Link>
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i <= step ? "bg-[var(--vela-blue)] text-[var(--bg-primary)]" : "glass text-[var(--text-muted)]"
                }`}
              >
                {i + 1}
              </div>
              <span className="text-xs text-[var(--text-muted)] hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {isPending && <p className="text-[var(--text-muted)]">Loading…</p>}
        {!isPending && step === 0 && <CreateAccount />}

        {userId && !state && !error && <p className="text-[var(--text-muted)]">Loading…</p>}
        {userId && error && <p className="text-[var(--vela-red)]">{error}</p>}

        {state && userId && step === 1 && <CreateWallet userId={userId} onCreated={refresh} />}

        {state?.wallet && step === 2 && (
          <FundWallet
            walletAddress={state.wallet.address}
            usdc={state.portfolio?.USDC.usd ?? 0}
            depositCapUsd={state.depositCapUsd ?? 100}
            onRefresh={refresh}
          />
        )}

        {state?.wallet && step === 3 && (
          <ConfigureAgent
            balanceUsd={state.totalUsd ?? 0}
            onHired={() => router.push("/dashboard")}
          />
        )}
      </main>
    </div>
  );
}
