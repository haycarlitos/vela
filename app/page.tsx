import Image from "next/image";
import Link from "next/link";
import { OceanBackground } from "@/components/ocean-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { MAX_DEPOSIT_USD, SESSION_SECONDS, TICK_INTERVAL_MINUTES, describeTickInterval } from "@/lib/config";

// No pricing: Vela is open source and each deployment runs its own agents.
// The numbers below come from lib/config, so a fork's landing tells the truth
// about its own limits.

const sessionDays = Math.round(SESSION_SECONDS / 86_400);
const tickEvery = describeTickInterval(TICK_INTERVAL_MINUTES);
// A fork sets NEXT_PUBLIC_REPO_URL to its own repository.
const repoUrl = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/haycarlitos/vela";

const steps = [
  {
    title: "Create your wallet",
    body: "Open it with a passkey: your face, fingerprint or device PIN. No seed phrase, no password. Already on Starknet? Sign in with Bramble, Braavos or Ready.",
  },
  {
    title: "Add USDC",
    body: `Send it from the wallet you already use, or to your new address. Up to $${MAX_DEPOSIT_USD} while Vela is in beta.`,
  },
  {
    title: "Hire the agent",
    body: `Pick a strategy and a cap, then approve once. The agent gets its own key that expires in ${sessionDays} days and can't spend past your caps.`,
  },
  {
    title: "Watch it, stop it, cash out",
    body: "Your dashboard shows every decision and why. Stop the agent with one tap, and withdraw to the wallet you came with.",
  },
];

const safety = [
  {
    title: "Your wallet, your keys",
    body: "Self-custodial. Vela only holds the agent's limited key, never yours.",
  },
  {
    title: "Caps written on-chain",
    body: "Per-trade and per-day limits are enforced by your wallet contract, not by our server.",
  },
  {
    title: "The AI advises, code decides",
    body: "Every decision passes fixed rules before anything is signed. A bad answer becomes a hold.",
  },
  {
    title: "Stop it any time",
    body: "One Face ID revokes the agent's key. From the next block it is worthless.",
  },
  {
    title: "Funds only come back to you",
    body: "Yield goes through a small contract that can only return funds to your wallet, and withdrawals go to the wallet you signed in with.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative">
      <OceanBackground />

      <nav className="flex items-center justify-between px-6 py-4 relative z-10 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/velalogo-clean.png" alt="Vela" width={24} height={24} />
          <span className="text-lg font-bold">Vela</span>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full glass text-[var(--text-muted)]">Beta</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/onboarding" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Sign in
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="flex flex-col items-center text-center px-6 pt-16 pb-20 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            An AI agent that invests for you, <span className="shimmer-text">inside limits your wallet enforces</span>
          </h1>
          <p className="text-lg text-[var(--text-secondary)] mb-10 max-w-xl">
            A self-custodial Starknet wallet you open with your face, and an agent that trades and earns yield for you,
            {" "}{tickEvery}, within spending caps written on-chain. Stop it whenever you want.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/onboarding"
              className="px-8 py-3 rounded-full bg-[var(--vela-blue)] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
            <a href="#safety" className="px-8 py-3 rounded-full glass font-medium hover:opacity-90 transition-opacity">
              Why it&apos;s safe
            </a>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 pb-20 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">How it works</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title} className="glass p-6">
                <span className="font-mono text-sm text-[var(--vela-blue)]">{i + 1}</span>
                <h3 className="font-semibold mt-2 mb-2">{step.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* What the agent does */}
        <section className="px-6 pb-20 max-w-3xl mx-auto">
          <div className="glass p-8">
            <h2 className="text-2xl font-bold mb-4">What the agent does</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              {tickEvery.charAt(0).toUpperCase() + tickEvery.slice(1)} it reads your balances and market signals, asks an AI
              model for one decision and checks it against rules in code. Then it either waits, swaps between USDC, ETH and
              STRK on AVNU, or puts USDC to work on Vesu.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Every decision, with its reason and its transaction, shows up in your dashboard. You never pay gas.
            </p>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="px-6 pb-20 max-w-5xl mx-auto scroll-mt-8">
          <h2 className="text-2xl font-bold mb-8 text-center">Why it&apos;s safe</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {safety.map((item) => (
              <div key={item.title} className="glass p-6">
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Risks */}
        <section className="px-6 pb-20 max-w-3xl mx-auto">
          <div className="glass p-8 border border-[var(--vela-gold)]/40">
            <h2 className="text-xl font-bold mb-3">Before you start</h2>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)] leading-relaxed list-disc pl-5">
              <li>Vela is a beta. The wallet contract&apos;s audit is pending, so deposits are limited to ${MAX_DEPOSIT_USD}.</li>
              <li>The agent can lose money within the caps you set: markets move and the AI can be wrong.</li>
              <li>This is not financial advice. Only deposit what you can afford to lose.</li>
            </ul>
            <Link href="/terms" className="inline-block mt-4 text-sm underline text-[var(--vela-blue)]">
              Read the terms
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--glass-border)] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-muted)]">
          <p>
            Built on{" "}
            <a href="https://www.starknet.io" target="_blank" rel="noreferrer" className="underline">
              Starknet
            </a>{" "}
            with{" "}
            <a href="https://chipipay.com" target="_blank" rel="noreferrer" className="underline">
              Chipi
            </a>
          </p>
          <div className="flex gap-6">
            {repoUrl && (
              <a href={repoUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)]">
                Open source · Learn to build it
              </a>
            )}
            <Link href="/terms" className="hover:text-[var(--text-primary)]">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
