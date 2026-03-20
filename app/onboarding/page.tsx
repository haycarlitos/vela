"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChipiWallet } from "@chipi-stack/nextjs";
import Link from "next/link";
import { CreateWallet } from "@/components/onboarding/create-wallet";
import { FundWallet } from "@/components/onboarding/fund-wallet";
import { ConfigureAgent } from "@/components/onboarding/configure-agent";

type Step = "id" | "wallet" | "fund" | "configure";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("id");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);

  // Try loading existing wallet
  const { wallet, hasWallet, isLoadingWallet } = useChipiWallet({
    externalUserId: userId || null,
    getBearerToken: async () => process.env.NEXT_PUBLIC_CHIPI_API_KEY!,
  });

  const handleUserIdSubmit = () => {
    if (!userId.trim()) return;
    if (hasWallet && wallet) {
      // Wallet already exists for this user
      setWalletAddress(wallet.publicKey);
      setStep("fund");
    } else {
      setStep("wallet");
    }
  };

  const handleWalletCreated = (address: string, walletPin: string) => {
    setWalletAddress(address);
    setPin(walletPin);
    setStep("fund");
  };

  const handleFunded = (bal: number) => {
    setBalance(bal);
    setStep("configure");
  };

  const handleHired = () => {
    // Redirect to dashboard with wallet address
    router.push(`/dashboard?wallet=${walletAddress}`);
  };

  const stepIndex = ["id", "wallet", "fund", "configure"].indexOf(step);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
        <Link href="/" className="text-xl font-bold gradient-text">
          Vela
        </Link>
        <div className="flex items-center gap-2">
          {["ID", "Wallet", "Fund", "Configure"].map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i <= stepIndex
                    ? "bg-[var(--vela-blue)] text-[var(--bg-primary)]"
                    : "glass text-[var(--text-muted)]"
                }`}
              >
                {i + 1}
              </div>
              <span className="text-xs text-[var(--text-muted)] hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {/* Step 1: User ID */}
        {step === "id" && (
          <div className="glass p-8 max-w-md mx-auto text-center">
            <h2 className="text-2xl font-bold mb-2">Welcome to Vela</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Enter a user ID to get started. This links your wallet to your identity.
            </p>
            <input
              type="text"
              placeholder="e.g., carlos, my-agent, test-1"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full glass p-3 bg-transparent outline-none text-sm mb-4 focus:border-[var(--vela-blue)]"
            />
            <button
              onClick={handleUserIdSubmit}
              disabled={!userId.trim() || isLoadingWallet}
              className="w-full py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
            >
              {isLoadingWallet ? "Checking wallet..." : "Continue"}
            </button>
          </div>
        )}

        {/* Step 2: Create wallet */}
        {step === "wallet" && (
          <div>
            <CreateWallet
              externalUserId={userId}
              onWalletCreated={handleWalletCreated}
            />
            <p className="text-xs text-[var(--text-muted)] text-center mt-4">
              Remember your PIN - you&apos;ll need it to hire the agent.
            </p>
          </div>
        )}

        {/* Step 3: Fund wallet */}
        {step === "fund" && (
          <FundWallet walletAddress={walletAddress} onFunded={handleFunded} />
        )}

        {/* Step 4: Configure agent */}
        {step === "configure" && (
          <ConfigureAgent
            wallet={{ publicKey: walletAddress, walletType: "CHIPI" }}
            pin={pin}
            balance={balance}
            onHired={handleHired}
          />
        )}
      </main>
    </div>
  );
}
