# Vela: the course

**Learn blockchain and AI by building an agent you can trust with money.**

You will build a real agent on Starknet mainnet. It manages a few dollars in a wallet only you control, decides with an AI model, and trades on its own. You approve it once with your face or fingerprint, and the wallet contract itself enforces how much it can spend.

No prior blockchain or AI experience needed. You need to read TypeScript and run `npm`.

## Two ways to take it

1. **Deploy first, then read.** Module 0 gets the finished app running on your own Vercel account in about 15 minutes. Then read the modules in order with the working code next to you.
2. **Build it yourself.** Each module names the 1–3 files it builds and the test that passes when you are done. Rebuild those files module by module and check your work with the tests.

Either way, every exercise runs on mainnet with cents. Nothing here is a simulation.

## Syllabus

| # | Module | You learn | You build |
|---|---|---|---|
| 0 | [Setup in 15 minutes](./00-setup.md) | The pieces of an AI + blockchain app | Your own deploy |
| **A** | **Blockchain from zero** | | |
| 1 | [What is a wallet?](./01-wallets.md) | Keys, addresses, tokens, decimals, smart accounts | `lib/portfolio.ts` |
| 2 | [Your face is your key](./02-passkeys.md) | Passkeys, PRF, self-custody | `lib/auth.ts`, `components/onboarding/create-wallet.tsx` |
| 3 | [Transactions](./03-transactions.md) | Signing, receipts, events, gasless | `lib/agent.ts` (the receipt part) |
| **B** | **Delegate without handing over your keys** | | |
| 4 | [Session keys](./04-session-keys.md) | A second key with limited powers | `lib/config.ts` (the session) |
| 5 | [Spending caps](./05-spending-caps.md) | Limits the wallet contract enforces | `spendingPolicies` in `lib/policy.ts` |
| 6 | [Hire the agent with one prompt](./06-hire.md) | Session + caps in one transaction, verified on-chain | `app/api/agents/route.ts`, `use-hire-agent.ts` |
| 7 | [Stop, expire, renew](./07-stop.md) | Revocation, expiry and renewal | `stop-agent`, the stop path of `runTick`, `session-notice` |
| **C** | **AI that acts** | | |
| 8 | [A model as a decision maker](./08-model.md) | Prompts, structured output, Chipi's AI API | `lib/brain.ts` |
| 9 | [Harnessing](./09-harnessing.md) | Context, schemas, validation, guardrails, logs | `decide` in `lib/policy.ts` |
| 10 | [From decision to transaction](./10-execute.md) | Building calls, signing with the session, checking the result | `runTick` in `lib/agent.ts` |
| 11 | [The autonomous loop](./11-loop.md) | Schedulers, idempotency, auto-stop | `app/api/tick/route.ts`, `claimDueAgent` |
| 12 | [The agent pays for its intelligence](./12-x402.md) | x402: pay per call from the session | `think` in `lib/brain.ts`, `sdk.ai.think` |
| **D** | **Your first contract** | | |
| 13 | [Yield without losing control](./13-vault-router.md) | Cairo, fork tests, deploying | `contracts/vault-router` |
| **E** | **Run it safely** | | |
| 14 | [Threat model](./14-threat-model.md) | What a leaked key can and cannot do | A red-team of your agent |
| 15 | [Monitoring](./15-monitoring.md) | Reading state from the chain | The dashboard's data |
| 16 | [Next steps](./16-next-steps.md) | Where to go from here | |
| **F** | **Meet users where they are** | | |
| 17 | [Bring your own wallet](./17-bring-your-wallet.md) | Sign in with Starknet, counterfactual accounts, funding and withdrawals | `lib/auth-starknet.ts`, `lib/starknet-wallet.ts` |
| 18 | [Trusted wallets](./18-trusted-wallets.md) | Multiple owners, roles, governance timelocks | `lib/trusted-wallets.ts`, `trusted-wallets.tsx`, `recovery-alert.tsx` |
| 19 | [Recover a lost passkey](./19-recover.md) | Recovery adds an owner; rotating owner 0; verify before storing | `lib/recovery.ts`, `api/recovery`, `recover-flow.tsx` |

## How each module works

- **The idea**, in plain words and a small diagram.
- **The code**, file by file, pointing at the lines that matter.
- **An exercise** on mainnet, with cents.
- **A test** that passes when you got it right: `npx vitest run <file>`, or `snforge test` for the contract.
