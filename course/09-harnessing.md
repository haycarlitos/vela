# Module 9. Harnessing: what surrounds the model

The model is the least reliable part of an agent. Harnessing is everything you build around it so its mistakes cannot hurt you: what it sees, what it may answer, what you check, what you refuse, what you record.

**Rule of this course: the model advises, the code decides.**

## The five parts

| Part | Question | In Vela |
|---|---|---|
| **Context** | What does the model see? | Portfolio in USD, risk score, max trade (`lib/brain.ts`); live signals and yields (added by Chipi) |
| **Action schema** | What may it answer? | `swap`, `supply`, `withdraw`, `hold`, with `from`, `to`, `amount`, `reason` |
| **Output validation** | Is the answer well-formed? | `isThinkDecision` from the SDK: anything else becomes `hold` |
| **Guardrails** | Is it allowed and sane? | `decide()` in `lib/policy.ts` |
| **Record** | What happened, and why? | Every decision, its reason, its cost and its receipt in the `decisions` table (`logDecision`) |

`decide()` turns the model's answer into an action or a hold. It checks that:

1. The answer is a valid decision.
2. The action is part of the user's strategy (Conservative never swaps).
3. The tokens are ones Vela trades, and not the same on both sides.
4. The amount exists, is capped at the user's max trade, and at what the wallet actually holds.
5. The amount is at least `MIN_TRADE_USD` ($0.50): smaller trades are eaten by fees.

The on-chain caps (module 5) repeat the most important limit inside the wallet contract. Two independent guards: a bug in `decide()` still cannot spend more than the caps.

## Exercise

Add a rule to `decide()`: never swap USDC away if the swap would leave the wallet with less than $2 of USDC. Write the test first in `lib/__tests__/policy.test.ts`, watch it fail, then make it pass.

## Test

```bash
npx vitest run lib/__tests__/policy.test.ts -t decide
```
