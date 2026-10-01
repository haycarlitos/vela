// What each strategy lets the agent do. No SDK imports: the UI uses this too.

export type Strategy = "conservative" | "balanced" | "aggressive";

export const STRATEGIES: Record<
  Strategy,
  { riskScore: number; actions: ReadonlyArray<"swap" | "supply" | "withdraw">; label: string; description: string }
> = {
  conservative: {
    riskScore: 2,
    actions: ["supply", "withdraw"],
    label: "Conservative",
    description: "Yield only: USDC in Vesu, no trading",
  },
  balanced: {
    riskScore: 5,
    actions: ["supply", "withdraw", "swap"],
    label: "Balanced",
    description: "Yield plus small trades when the signal is strong",
  },
  aggressive: {
    riskScore: 8,
    actions: ["supply", "withdraw", "swap"],
    label: "Aggressive",
    description: "Active trading plus yield",
  },
};

export function isStrategy(value: unknown): value is Strategy {
  return typeof value === "string" && Object.hasOwn(STRATEGIES, value);
}
