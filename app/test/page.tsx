"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const X402PaySection = dynamic(() => import("./x402-pay-wrapper"), { ssr: false });

type TestResult = {
  step: string;
  status: "pending" | "success" | "error" | "info";
  data?: unknown;
  error?: string;
};

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result]);
  };

  const clearResults = () => setResults([]);

  // Test 1: x402 402 response
  const testX402Response = async () => {
    setLoading(true);
    clearResults();

    addResult({ step: "Calling POST /api/test-x402 without X-PAYMENT header...", status: "pending" });

    try {
      const res = await fetch("/api/test-x402", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const paymentHeader = res.headers.get("PAYMENT-REQUIRED");
      const text = await res.text();
      const body = text ? JSON.parse(text) : { error: `Empty response (status ${res.status})` };

      if (res.status === 402) {
        addResult({
          step: "402 Payment Required received",
          status: "success",
          data: {
            httpStatus: res.status,
            paymentRequirement: paymentHeader ? JSON.parse(paymentHeader) : body.x402,
          },
        });

        const requirement = paymentHeader ? JSON.parse(paymentHeader) : body.x402;
        addResult({
          step: "Payment details",
          status: "info",
          data: {
            scheme: requirement.scheme,
            network: requirement.network,
            amount: `${Number(requirement.maxAmountRequired) / 1e6} USDC`,
            amountRaw: requirement.maxAmountRequired,
            asset: requirement.asset,
            payTo: requirement.payTo,
            description: requirement.description,
          },
        });
      } else {
        addResult({
          step: `Unexpected status: ${res.status}`,
          status: "error",
          data: body,
        });
      }
    } catch (err) {
      addResult({
        step: "Request failed",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    setLoading(false);
  };

  // Test 2: Facilitator health
  const testFacilitator = async () => {
    setLoading(true);
    clearResults();

    addResult({ step: "Checking facilitator at x402.chipipay.com...", status: "pending" });

    try {
      const res = await fetch("https://x402.chipipay.com/api/health");
      const body = await res.json();

      addResult({
        step: `Facilitator responded: ${res.status}`,
        status: res.ok ? "success" : "error",
        data: body,
      });
    } catch (err) {
      addResult({
        step: "Facilitator unreachable",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    setLoading(false);
  };

  const statusColor = (status: TestResult["status"]) => {
    switch (status) {
      case "success": return "var(--vela-green)";
      case "error": return "var(--vela-red)";
      case "info": return "var(--vela-blue)";
      case "pending": return "var(--vela-gold)";
    }
  };

  const statusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "success": return "OK";
      case "error": return "ERR";
      case "info": return "INFO";
      case "pending": return "...";
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
        <Link href="/" className="text-xl font-bold gradient-text">
          Vela
        </Link>
        <span className="text-sm text-[var(--text-muted)] font-mono">x402 Test Console</span>
      </header>

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-2">x402 Protocol Test</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          Test x402 payment protocol on Starknet mainnet. Real endpoints, real wallet signing.
        </p>

        {/* Quick Tests */}
        <div className="space-y-3 mb-8">
          <button
            onClick={testX402Response}
            disabled={loading}
            className="w-full glass p-4 text-left hover:scale-[1.01] transition-transform disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--vela-blue)]">Test: x402 Payment Gate</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  POST /api/test-x402 without payment. Expects HTTP 402 + PaymentRequirement header.
                </p>
              </div>
              <span className="text-2xl font-mono text-[var(--text-muted)]">402</span>
            </div>
          </button>

          <button
            onClick={testFacilitator}
            disabled={loading}
            className="w-full glass p-4 text-left hover:scale-[1.01] transition-transform disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--vela-blue)]">Test: Facilitator Health</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Check x402.chipipay.com facilitator status.
                </p>
              </div>
              <span className="text-2xl font-mono text-[var(--text-muted)]">GET</span>
            </div>
          </button>
        </div>

        {/* Quick Test Results */}
        {results.length > 0 && (
          <div className="space-y-2 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Results</h2>
              <button
                onClick={clearResults}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                Clear
              </button>
            </div>
            {results.map((result, i) => (
              <div key={i} className="glass p-3" style={{ borderLeft: `3px solid ${statusColor(result.status)}` }}>
                <div className="flex items-start gap-3">
                  <span
                    className="text-xs font-mono font-bold shrink-0 mt-0.5"
                    style={{ color: statusColor(result.status) }}
                  >
                    [{statusIcon(result.status)}]
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{result.step}</p>
                    {result.error && (
                      <p className="text-xs text-[var(--vela-red)] mt-1 font-mono">{result.error}</p>
                    )}
                    {result.data != null && (
                      <pre className="text-xs text-[var(--text-muted)] mt-2 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[var(--glass-border)] my-8" />

        {/* Full Payment Test */}
        <h2 className="text-xl font-bold mb-2">Full x402 Payment</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Connect your Chipi wallet, sign SNIP-12 typed data, and send a real $0.001 USDC payment via x402.
        </p>

        <X402PaySection />

        {/* Info Box */}
        <div className="glass p-4 mt-8">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">How x402 works</h3>
          <ol className="text-xs text-[var(--text-muted)] space-y-1.5 list-decimal list-inside">
            <li>Client calls protected endpoint without payment</li>
            <li>Server returns <span className="text-[var(--vela-gold)] font-mono">HTTP 402</span> + <span className="font-mono">PAYMENT-REQUIRED</span> header</li>
            <li>Client reads payment details (amount, asset, recipient)</li>
            <li>Client signs SNIP-12 typed data (USDC transfer authorization)</li>
            <li>Client retries with <span className="font-mono">X-PAYMENT</span> header containing signed payload</li>
            <li>Server verifies via facilitator, executes request, then settles payment on-chain</li>
          </ol>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Cost: <span className="text-[var(--vela-green)] font-mono">$0.001 USDC</span> |
            Facilitator: <span className="font-mono">x402.chipipay.com</span> |
            Network: <span className="font-mono">starknet-mainnet</span>
          </p>
        </div>
      </main>
    </div>
  );
}
