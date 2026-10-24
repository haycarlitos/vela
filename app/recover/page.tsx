"use client";

import { useState } from "react";
import Link from "next/link";
import { useChipiWallet } from "@chipi-stack/nextjs";
import { RecoverFlow } from "@/components/recover/recover-flow";
import { SignOutButton } from "@/components/sign-out-button";
import { StarknetWalletSignIn } from "@/components/starknet-wallet-sign-in";
import { authClient, getChipiToken } from "@/lib/auth-client";

/**
 * Lost your passkey? Sign in with the Starknet wallet you linked, and your
 * recovery wallet (or co-owner) moves your Vela wallet to a new passkey here.
 */
export default function RecoverPage() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const [newAccount, setNewAccount] = useState(false);
  const { wallet } = useChipiWallet({ externalUserId: userId ?? null, getBearerToken: getChipiToken });

  let body: React.ReactNode;
  if (isPending) {
    body = <p className="text-[var(--text-muted)]">Loading…</p>;
  } else if (!userId) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Sign in with the Starknet wallet you linked to Vela (Bramble, Braavos, Ready). Your passkey isn&apos;t needed.
        </p>
        <StarknetWalletSignIn mode="signin" onDone={({ created }) => setNewAccount(created)} />
      </div>
    );
  } else if (newAccount || wallet === null) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          This account has no Vela wallet. Recovery works from the account your wallet lives in: sign out, then sign in with the
          Starknet wallet you linked from your dashboard.
        </p>
        <SignOutButton />
      </div>
    );
  } else if (!wallet) {
    body = <p className="text-[var(--text-muted)]">Loading your wallet…</p>;
  } else {
    body = <RecoverFlow userId={userId} wallet={wallet} />;
  }

  return (
    <div className="min-h-screen max-w-xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold gradient-text">
          Vela
        </Link>
        {userId && <SignOutButton />}
      </header>
      <div className="glass p-6 space-y-4">
        <h1 className="text-2xl font-bold">Recover your wallet</h1>
        {body}
      </div>
    </div>
  );
}
