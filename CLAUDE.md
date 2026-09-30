# Vela — "Set sail. Let AI navigate."

Open-source DeFi agent on a self-custodial Starknet wallet: passkey (SHHH), session keys capped on-chain, Chipi's AI API, x402 per decision, gasless.

## Stack
- **Framework**: Next.js 16 (App Router, Turbopack), `proxy.ts` for auth
- **Language**: TypeScript (strict)
- **Auth**: Clerk; its JWKS is registered in the Chipi dashboard
- **Chipi**: `@chipi-stack/nextjs` (browser) and `@chipi-stack/backend` (server) 14.14+
- **AI**: Chipi AI API through `sdk.ai` (no direct model provider)
- **Database**: Postgres via `pg` (`DATABASE_URL`)
- **Styling**: Tailwind CSS + Framer Motion (liquid glass design)
- **Tests**: Vitest

## Key Conventions
- Always mainnet, never testnet/Sepolia
- USDC: `0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb` (native, NOT USDC.e)
- Vesu: the Re7 USDC Core vault in `lib/config.ts` (native USDC). Not the SDK's `VESU_USDC_MAINNET` (USDC.e)
- The owner key never leaves the browser: register, cap and revoke the session there with `useChipiSession` + `getEncryptKey`
- The server holds only the session key, encrypted with `VELA_SESSION_SECRET`, and executes with `executeTransactionWithSession`
- Every token an agent wallet can hold needs a spending policy (the whitelist is not scoped to a contract); `maxPerWindow` is never 0 (0 = no cap)
- The model advises, `lib/policy.ts` decides. Never act on `sdk.ai.think` output without `decide()`
- A tx hash is not a result: always `waitForTransaction`
- x402: $0.001 per decision, paid with a session-signed USDC transfer and verified with `SessionTxVerifier` (single use in `x402_payments`)
- No workarounds around the SDK: if Vela needs something the SDK lacks, add it to the SDK

## Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest
```

## Project Structure
```
app/
  page.tsx                  # Landing
  demo/page.tsx             # Marketing demo (sample data)
  onboarding/               # Passkey wallet → fund → hire
  dashboard/page.tsx        # Live agent status, portfolio, activity, stop
  api/agents/route.ts       # GET state · POST create session · PATCH confirm/stop
  api/tick/route.ts         # Scheduler entry (CRON_SECRET)
  api/think/route.ts        # Paid decision endpoint (x402)

lib/
  config.ts                 # Addresses, session limits, beta cap
  strategies.ts             # Strategy definitions (no SDK imports; used by the UI)
  policy.ts                 # decide() and spendingPolicies()
  agent.ts                  # runTick()
  brain.ts                  # sdk.ai.think wrapper
  portfolio.ts, vesu.ts     # Balances, prices, Vesu position and calls
  x402.ts, payments.ts      # x402 terms/header, on-chain verification
  db.ts                     # Postgres (agents, decisions, x402_payments)
  chipi.ts                  # Server SDK + secrets
  use-agent-state.ts        # Client hook for GET /api/agents

components/
  onboarding/               # create-wallet, fund-wallet, configure-agent
  dashboard/                # agent-status, portfolio-card, activity-feed, stop-agent (+ demo-only cards)
```
