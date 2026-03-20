# Vela — "Set sail. Let AI navigate."

Autonomous DeFi agent powered by Chipi Pay session keys, gasless execution, and x402 micropayments on Starknet mainnet.

## Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS + Framer Motion (liquid glass design)
- **Charts**: Recharts
- **Blockchain**: starknet.js v9.2.1 (mainnet only)
- **AI**: @anthropic-ai/sdk (Claude Sonnet for agent decisions)
- **Database**: Vercel Postgres (@vercel/postgres)

## Key Conventions
- Always mainnet — never testnet/Sepolia
- USDC address: `0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb` (native, NOT USDC.e)
- STRK for gas (v3 transactions), but all gas is paymaster-sponsored
- x402 payments: $0.001 per agent decision
- Session keys handle all signing — no raw private keys anywhere

## Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Typecheck

# Test scripts
npx tsx scripts/test-agent-loop.ts <wallet_address>
npx tsx scripts/test-standard-payment.ts
npx tsx scripts/test-session-payment.ts
```

## Project Structure
```
app/
  page.tsx                      # Landing page
  dashboard/page.tsx            # Agent dashboard
  api/agent/think/route.ts      # x402-protected Claude decision endpoint
  api/agent/execute/route.ts    # Execute DeFi action via session key
  api/agent/status/route.ts     # Portfolio state + decision history
  api/cron/route.ts             # Vercel cron (every 30 min)

lib/
  config.ts                     # Constants, addresses, limits
  db.ts                         # Vercel Postgres (decisions + snapshots tables)
  agent-brain.ts                # Claude prompt builder + decision parser
  x402-route.ts                 # withX402Payment() middleware
  session.ts                    # Session key execution wrapper
  defi/
    portfolio.ts                # Token balances, prices, Vesu positions
    avnu.ts                     # AVNU swap quotes + call builder
    vesu.ts                     # Vesu supply/withdraw call builder

components/
  onboarding/                   # Wallet creation, funding, agent config
  dashboard/                    # Status, activity feed, P&L chart, stop
  action-card.tsx               # Single decision card
```
