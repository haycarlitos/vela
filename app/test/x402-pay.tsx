"use client";

import { useState, useRef } from "react";
import { Contract, RpcProvider, type AccountInterface, type WalletAccount } from "starknet";

type PayStep = {
  label: string;
  status: "pending" | "success" | "error" | "info";
  data?: unknown;
  error?: string;
};

const MERCHANT_WALLET = "0x0189E2EBb955fc19bf37bD8Fc0400De24C123363E7955282bcfb99679a773E61";
const USDC_ADDRESS = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";
const RPC_URL = "https://starknet-mainnet.infura.io/v3/4a4a1fdd7d704509aa99154fb29886e2";

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
] as const;

export default function X402PayClient() {
  const [steps, setSteps] = useState<PayStep[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletName, setWalletName] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [paying, setPaying] = useState(false);
  const accountRef = useRef<AccountInterface | null>(null);

  const addStep = (step: PayStep) => {
    setSteps((prev) => [...prev, step]);
  };

  const handleConnect = async () => {
    setSteps([]);
    addStep({ label: "Looking for wallet extensions...", status: "pending" });

    try {
      // Check for injected wallet providers (Argent X, Braavos)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      const starknetArgent = win.starknet_argentX as StarknetWallet | undefined;
      const starknetBraavos = win.starknet_braavos as StarknetWallet | undefined;
      const starknetDefault = win.starknet as StarknetWallet | undefined;

      const wallet = starknetArgent || starknetBraavos || starknetDefault;

      if (!wallet) {
        addStep({
          label: "No wallet found",
          status: "error",
          error: "Install Argent X or Braavos browser extension",
        });
        return;
      }

      addStep({ label: `Found ${wallet.name || "wallet"}, requesting connection...`, status: "pending" });

      // Request connection
      await wallet.enable();

      if (!wallet.isConnected || !wallet.account) {
        addStep({ label: "Wallet connection rejected", status: "error" });
        return;
      }

      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const { WalletAccount } = await import("starknet");
      const addr = wallet.account!.address;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const walletAccount = new WalletAccount({ provider, walletProvider: wallet as any, address: addr });

      accountRef.current = walletAccount;
      setWalletAddress(addr);
      setWalletName(wallet.name || "Wallet");
      setWalletConnected(true);
      addStep({
        label: `Connected: ${addr.slice(0, 10)}...${addr.slice(-6)}`,
        status: "success",
        data: { wallet: wallet.name, address: addr },
      });
    } catch (err) {
      addStep({ label: "Connection failed", status: "error", error: String(err) });
    }
  };

  const handleDisconnect = () => {
    accountRef.current = null;
    setWalletConnected(false);
    setWalletAddress("");
    setWalletName("");
    setSteps([]);
  };

  const handlePay = async () => {
    const account = accountRef.current;
    if (!account || !walletAddress) return;
    setPaying(true);
    setSteps([]);

    try {
      // Step 1: Get 402 payment requirement
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

      // Step 2: Execute USDC transfer from connected wallet
      addStep({ label: "3. Approve transfer in your wallet...", status: "pending" });

      const usdc = new Contract({ abi: ERC20_ABI, address: USDC_ADDRESS, providerOrAccount: account });
      const transferResult = await usdc.transfer(
        MERCHANT_WALLET,
        { low: requirement.maxAmountRequired, high: "0" },
      );

      const txHash = transferResult.transaction_hash;

      addStep({
        label: "4. Transfer submitted on Starknet!",
        status: "success",
        data: { txHash },
      });

      // Step 3: Wait for confirmation
      addStep({ label: "5. Waiting for tx confirmation...", status: "pending" });

      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      await provider.waitForTransaction(txHash);

      addStep({
        label: "5. Transaction confirmed on-chain",
        status: "success",
      });

      // Step 4: Send to facilitator as session payment
      addStep({ label: "6. Recording payment on x402 facilitator...", status: "pending" });

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
          label: "7. x402 payment verified! Check x402.chipipay.com",
          status: "success",
          data: payData,
        });
      } else {
        addStep({
          label: `7. Facilitator responded: ${payRes.status}`,
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
            Connect your Argent X or Braavos wallet to pay $0.001 USDC via x402.
          </p>
          <button
            onClick={handleConnect}
            className="w-full py-3 rounded-xl bg-[var(--vela-blue)] text-[var(--bg-primary)] font-medium hover:brightness-110 transition-all"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold">Pay $0.001 USDC via x402</h3>
            <button
              onClick={handleDisconnect}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              Disconnect
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-1">{walletName}</p>
          <p className="text-xs font-mono text-[var(--text-muted)] mb-4">{walletAddress}</p>
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full py-3 rounded-xl bg-[var(--vela-green)] text-[var(--bg-primary)] font-bold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {paying ? "Processing..." : "Pay $0.001 USDC"}
          </button>
          <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
            Real USDC transfer on Starknet mainnet - you approve in your wallet
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

// Minimal type for injected wallet extensions (Argent X, Braavos)
interface StarknetWallet {
  name?: string;
  isConnected: boolean;
  account?: { address: string };
  enable: () => Promise<string[]>;
}
