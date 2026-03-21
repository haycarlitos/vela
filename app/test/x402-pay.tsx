"use client";

import { useState } from "react";

type PayStep = {
  label: string;
  status: "pending" | "success" | "error" | "info";
  data?: unknown;
  error?: string;
};

const MERCHANT_WALLET = "0x0189E2EBb955fc19bf37bD8Fc0400De24C123363E7955282bcfb99679a773E61";
const USDC_ADDRESS = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";
const API_KEY = process.env.NEXT_PUBLIC_CHIPI_API_KEY!;
const CHIPI_API = "https://api.chipipay.com";

export default function X402PayClient() {
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [steps, setSteps] = useState<PayStep[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [paying, setPaying] = useState(false);

  const addStep = (step: PayStep) => {
    setSteps((prev) => [...prev, step]);
  };

  const handleConnect = async () => {
    if (!userId.trim()) return;
    setSteps([]);

    addStep({ label: "Looking up wallet...", status: "pending" });

    try {
      const res = await fetch(`${CHIPI_API}/v1/wallets?externalUserId=${encodeURIComponent(userId)}&chain=STARKNET`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });

      if (!res.ok) {
        const err = await res.text();
        addStep({ label: "Wallet lookup failed", status: "error", error: `${res.status}: ${err}` });
        return;
      }

      const data = await res.json();
      const wallet = data.wallet || data;

      if (wallet?.publicKey) {
        setWalletAddress(wallet.publicKey);
        setWalletConnected(true);
        addStep({
          label: `Wallet found: ${wallet.publicKey.slice(0, 10)}...${wallet.publicKey.slice(-6)}`,
          status: "success",
        });
      } else {
        addStep({ label: "No wallet found for this user ID", status: "error", data });
      }
    } catch (err) {
      addStep({ label: "Connection failed", status: "error", error: String(err) });
    }
  };

  const handlePay = async () => {
    if (!walletAddress || !pin) return;
    setPaying(true);
    setSteps([]);

    try {
      // Step 1: Get 402
      addStep({ label: "1. Calling /api/test-x402 (expecting 402)...", status: "pending" });

      const res402 = await fetch("/api/test-x402", { method: "POST" });
      const text = await res402.text();
      const body = text ? JSON.parse(text) : {};

      if (res402.status !== 402) {
        addStep({ label: `Expected 402, got ${res402.status}`, status: "error", data: body });
        setPaying(false);
        return;
      }

      const requirement = body.x402;
      addStep({
        label: "2. Got 402 Payment Required",
        status: "success",
        data: { amount: `${Number(requirement.maxAmountRequired) / 1e6} USDC`, payTo: requirement.payTo },
      });

      // Step 2: Transfer USDC on-chain via Chipi API directly
      addStep({ label: "3. Executing USDC transfer via Chipi API...", status: "pending" });

      const transferRes = await fetch(`${CHIPI_API}/v1/transactions/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          walletAddress,
          encryptKey: pin,
          contractAddress: USDC_ADDRESS,
          recipient: MERCHANT_WALLET,
          amount: "1000", // 0.001 USDC in base units
        }),
      });

      const transferText = await transferRes.text();
      const transferData = transferText ? JSON.parse(transferText) : {};

      if (!transferRes.ok) {
        addStep({
          label: `Transfer failed: ${transferRes.status}`,
          status: "error",
          data: transferData,
        });
        setPaying(false);
        return;
      }

      const txHash = transferData.transactionHash || transferData.transaction_hash || transferData.txHash || transferData;

      addStep({
        label: "4. Transfer executed on Starknet!",
        status: "success",
        data: { txHash },
      });

      // Step 3: Send to facilitator as session payment
      addStep({ label: "5. Recording payment on x402 facilitator...", status: "pending" });

      const nonce = crypto.randomUUID();
      const paymentPayload = {
        x402Version: 1,
        scheme: "exact",
        network: "starknet-mainnet",
        payload: {
          signature: { r: String(txHash), s: "session" },
          fromAddress: walletAddress,
          toAddress: MERCHANT_WALLET,
          amount: requirement.maxAmountRequired,
          asset: USDC_ADDRESS,
          validUntil: Math.floor(Date.now() / 1000) + 300,
          nonce,
        },
      };

      const payRes = await fetch("/api/test-x402", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": JSON.stringify(paymentPayload),
        },
      });

      const payText = await payRes.text();
      const payData = payText ? JSON.parse(payText) : {};

      if (payRes.ok) {
        addStep({
          label: "6. x402 payment recorded! Check x402.chipipay.com",
          status: "success",
          data: payData,
        });
      } else {
        addStep({
          label: `6. Facilitator responded: ${payRes.status}`,
          status: payRes.status === 402 ? "error" : "info",
          data: payData,
        });
      }
    } catch (err) {
      addStep({
        label: "Payment flow failed",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    setPaying(false);
  };

  return (
    <div className="space-y-4">
      {!walletConnected ? (
        <div className="glass p-6">
          <h3 className="font-semibold mb-3">Connect Your Wallet</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Enter the user ID you used when creating your Chipi wallet.
          </p>
          <input
            type="text"
            placeholder="User ID (e.g., carlos)"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            className="w-full glass p-3 bg-transparent outline-none text-sm mb-3"
          />
          <button
            onClick={handleConnect}
            disabled={!userId.trim()}
            className="w-full py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all disabled:opacity-50"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold">Pay $0.001 USDC via x402</h3>
            <button
              onClick={() => { setWalletConnected(false); setSteps([]); setPin(""); setWalletAddress(""); }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              Disconnect
            </button>
          </div>
          <p className="text-xs font-mono text-[var(--text-muted)] mb-4">{walletAddress}</p>
          <input
            type="password"
            inputMode="numeric"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && handlePay()}
            className="w-full glass p-3 bg-transparent outline-none text-center text-lg font-mono tracking-[0.3em] mb-3"
          />
          <button
            onClick={handlePay}
            disabled={paying || !pin || pin.length < 4}
            className="w-full py-3 rounded-xl bg-[var(--vela-green)] text-[var(--bg-primary)] font-bold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {paying ? "Processing..." : "Pay $0.001 USDC"}
          </button>
          <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
            Real USDC transfer on Starknet mainnet via Chipi API
          </p>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-[var(--text-secondary)]">Payment Flow</h4>
            <button onClick={() => setSteps([])} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Clear</button>
          </div>
          {steps.map((step, i) => (
            <div
              key={i}
              className="glass p-3"
              style={{
                borderLeft: `3px solid ${
                  step.status === "success" ? "var(--vela-green)" :
                  step.status === "error" ? "var(--vela-red)" :
                  step.status === "info" ? "var(--vela-blue)" :
                  "var(--vela-gold)"
                }`,
              }}
            >
              <p className="text-sm font-medium">{step.label}</p>
              {step.error && <p className="text-xs text-[var(--vela-red)] mt-1 font-mono">{step.error}</p>}
              {step.data != null && (
                <pre className="text-xs text-[var(--text-muted)] mt-1 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(step.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
