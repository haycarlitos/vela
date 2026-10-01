import Image from "next/image";
import Link from "next/link";
import { OceanBackground } from "@/components/ocean-background";
import { ThemeToggle } from "@/components/theme-toggle";

// Placeholder landing until the new design lands. No pricing: Vela is an
// open-source course you deploy yourself.

const steps = [
  "Create a self-custodial wallet with a passkey",
  "Delegate to an AI agent once, with spending caps enforced on-chain",
  "Watch it decide, trade and report, without signing anything else",
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative">
      <OceanBackground />

      <nav className="flex items-center justify-between px-6 py-4 relative z-10">
        <div className="flex items-center gap-2">
          <Image src="/velalogo-clean.png" alt="Vela" width={24} height={24} />
          <span className="text-lg font-bold">Vela</span>
        </div>
        <ThemeToggle />
      </nav>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center relative z-10">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">Vela</h1>
        <p className="text-xl text-[var(--text-primary)] mb-2">Learn blockchain and AI by building an agent you can trust with money.</p>
        <p className="text-sm text-[var(--text-secondary)] mb-10 max-w-md">
          An open-source Starknet agent built with Chipi. You keep your keys; the agent only gets a capped session key.
        </p>

        <ol className="text-left space-y-3 mb-10 max-w-md">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm text-[var(--text-secondary)]">
              <span className="font-mono text-[var(--vela-blue)]">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>

        <Link
          href="/onboarding"
          className="px-6 py-3 rounded-full bg-[var(--vela-blue)] text-white font-medium hover:opacity-90 transition-opacity"
        >
          Get started
        </Link>
      </main>
    </div>
  );
}
