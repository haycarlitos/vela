# Vela — learn blockchain and AI by building an agent you can trust with money

Open-source course and DeFi agent on a self-custodial Starknet wallet: passkey (SHHH), session keys capped on-chain, Chipi's AI API, gasless. No pricing: each student deploys their own.

## Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **Auth**: Better Auth in the app (anonymous account + passkey, JWT plugin RS256 with one key); `/api/auth/jwks` is registered in the Chipi dashboard (Better Auth provider). API routes call `currentUserId()`
- **Chipi**: `@chipi-stack/nextjs` (browser) and `@chipi-stack/backend` (server) 14.15+
- **AI**: Chipi AI API through `sdk.ai` (no direct model provider)
- **Database**: Postgres via `pg` (`DATABASE_URL`)
- **Styling**: Tailwind CSS + Framer Motion (liquid glass design)
- **Tests**: Vitest

## Key Conventions
- Always mainnet, never testnet/Sepolia
- Passkey only, never a PIN. The wallet is created with `useCreateWallet({ usePasskey: true })`; unlock it with `getWalletEncryptKey(wallet.credentialId)`
- USDC: `0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb` (native, NOT USDC.e)
- Vesu: the Re7 USDC Core vault in `lib/config.ts` (native USDC). Not the SDK's `VESU_USDC_MAINNET` (USDC.e)
- The owner key never leaves the browser: register, cap and revoke the session there with `useChipiSession` + `getEncryptKey`
- The server holds only the session key, encrypted with `sessionSecret()` (HKDF of `CHIPI_SECRET_KEY`, or `VELA_SESSION_SECRET`), and executes with `executeTransactionWithSession`
- Every token an agent wallet can hold needs a spending policy (the whitelist is not scoped to a contract); `maxPerWindow` is never 0 (0 = no cap)
- The model advises, `lib/policy.ts` decides. Never act on `sdk.ai.think` output without `decide()`
- A tx hash is not a result: always `waitForTransaction`
- No workarounds around the SDK: if Vela needs something the SDK lacks, add it to the SDK
- The user's own wallet (Bramble, Braavos, Ready) is identity, funding source and withdrawal destination, never the agent's wallet: only a Chipi wallet enforces the caps
- `course/` must match the code: when you change a file a lesson cites, update the lesson

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
  page.tsx                  # Landing (limits read from lib/config)
  terms/page.tsx            # Beta terms, plain language
  opengraph-image.tsx       # Share card
  onboarding/               # Passkey wallet → fund → hire
  dashboard/page.tsx        # Live agent status, portfolio, activity, stop
  api/agents/route.ts       # GET state · POST create session · PATCH confirm/stop
  api/auth/[...all]/route.ts # Better Auth (passkeys, /token for Chipi, /jwks)
  api/tick/route.ts         # Scheduler entry (Bearer CRON_SECRET when set; claimDueAgent enforces TICK_INTERVAL_MINUTES; reports failed/overdue)

lib/
  config.ts                 # Addresses, session limits, MAX_DEPOSIT_USD
  strategies.ts             # Strategy definitions (no SDK imports; used by the UI)
  policy.ts                 # decide() and spendingPolicies()
  agent.ts                  # runTick()
  brain.ts                  # sdk.ai.think wrapper
  portfolio.ts, vesu.ts     # Balances, prices, Vesu position and calls
  db.ts                     # Postgres (agents, decisions)
  chipi.ts                  # Server SDK + secrets
  auth.ts, auth-client.ts   # Better Auth server (getAuth, currentUserId) and client (getChipiToken)
  auth-starknet.ts          # Sign in with Starknet (Better Auth plugin: /starknet/nonce, /starknet/verify)
  starknet-wallet.ts        # The user's own wallet in the browser (discovery, sign, send USDC); Bramble-strict
  use-agent-state.ts        # Client hook for GET /api/agents

contracts/vault-router/      # Cairo router for Vesu (course module 13); snforge fork tests
course/                      # The course: 00-setup … 17-bring-your-wallet, each lesson cites real code

components/
  onboarding/               # create-account, create-wallet, fund-wallet, configure-agent
  dashboard/                # agent-status, portfolio-card, activity-feed, stop-agent
```
