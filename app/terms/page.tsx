import type { Metadata } from "next";
import Link from "next/link";
import { MAX_DEPOSIT_USD, SESSION_SECONDS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms · Vela",
  description: "What Vela is, what it is not, and the risks of letting an AI agent trade from your wallet.",
};

const sessionDays = Math.round(SESSION_SECONDS / 86_400);

// Plain-language draft. Keep it in sync with lib/config and SECURITY.md.
const sections: { title: string; body: string[] }[] = [
  {
    title: "What Vela is",
    body: [
      "Vela is open-source software: a self-custodial wallet on Starknet and an AI agent that can trade and earn yield from it, within limits you set.",
      "Vela is in beta. Features, limits and these terms can change.",
    ],
  },
  {
    title: "Your wallet is yours",
    body: [
      "Your wallet is opened with a passkey on your device. Its key is encrypted in your browser; Vela's servers never see it and cannot move your funds with it.",
      `When you hire the agent, you sign a separate key for it. That key expires after ${sessionDays} days, can only call a short list of functions, and can only spend up to the caps you choose. Your wallet contract enforces those caps.`,
      "If you lose access to your passkeys, Vela can't recover your wallet for you. You can, at /recover, if you added a recovery wallet or co-owner first; it takes about 8 days (1 with a co-owner).",
    ],
  },
  {
    title: "The agent can lose money",
    body: [
      "The agent's decisions come from an AI model and fixed rules. Markets move, models make mistakes, and the protocols it uses (AVNU, Vesu, Starknet) can fail or be exploited.",
      "You can lose funds, up to the caps you set and the balance of your wallet. The worst case and its numbers are documented in Vela's SECURITY.md.",
      `While the wallet contract's audit is pending, Vela limits deposits to $${MAX_DEPOSIT_USD}. Only deposit what you can afford to lose.`,
    ],
  },
  {
    title: "Not financial advice",
    body: [
      "Nothing in Vela, including the agent's decisions and their reasons, is financial, investment, legal or tax advice. You decide whether to use it.",
    ],
  },
  {
    title: "Stopping the agent",
    body: [
      "You can stop the agent at any time from the dashboard. Stopping revokes its key on-chain. A transaction already sent before you stop can still complete.",
    ],
  },
  {
    title: "Fees",
    body: [
      "Vela charges no fee. Network gas is sponsored. Swaps pay the usual protocol and slippage costs, and the agent may pay a small amount in USDC for each AI decision when the deployment enables it.",
    ],
  },
  {
    title: "No warranty",
    body: [
      "Vela is provided \"as is\", without warranties of any kind, under the MIT license. To the extent the law allows, its authors and operators are not liable for losses from using it.",
    ],
  },
  {
    title: "Your data",
    body: [
      "Vela stores an anonymous account id, your wallet address, your agent's settings and its decisions. It does not ask for your name or email. Transactions are public on Starknet.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/" className="text-sm text-[var(--vela-blue)] hover:underline">
        ← Vela
      </Link>
      <h1 className="text-3xl font-bold mt-6 mb-2">Terms</h1>
      <p className="text-sm text-[var(--text-muted)] mb-10">Beta draft · last updated October 7, 2026</p>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold mb-2">{section.title}</h2>
            <div className="space-y-2 text-[var(--text-secondary)] leading-relaxed">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
