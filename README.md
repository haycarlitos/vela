# Vela

**Learn blockchain and AI by building an agent you can trust with money.** An open-source course and a working DeFi agent on a self-custodial Starknet wallet, built with [Chipi](https://chipipay.com).

- **Your wallet, your key.** A SHHH smart wallet secured by your passkey (WebAuthn PRF). Neither Vela nor Chipi can decrypt it.
- **Delegate once.** One passkey prompt hires the agent, one stops it. In between, the agent signs with a session key the wallet contract limits by itself: which functions, how many calls, for how long, and how much USDC, ETH and STRK per trade and per day.
- **The model advises, code decides.** The agent thinks with Chipi's AI API (`sdk.ai.think`, live market signals and yields), and a deterministic policy (`lib/policy.ts`) decides what actually reaches the chain.
- **No gas.** Every transaction is sponsored by Chipi's paymaster.

> SHHH V8.4 is pending its external audit. By default the agent manages wallets up to $100 (`MAX_DEPOSIT_USD`). The agent can lose money within its limits. See [SECURITY.md](./SECURITY.md).

## How it works

```
Browser                                   Vela server                              Starknet
───────                                   ───────────                              ────────
Sign-in → passkey (PRF) → SHHH wallet ───────────────────────────────────────────▶ deploy (gasless)
"Hire agent" ──POST /api/agents──▶ createSessionKey (encrypted at rest)
passkey prompt: registerSession(key, whitelist, caps) ──────────────────────────▶ session + spending policies, one tx
             ──PATCH /api/agents──▶ waits for the tx, checks the session on-chain, activates
                                   cron → /api/tick, for each agent that is due:
                                     session live? → portfolio (sdk.ai.prices + balances + Vesu)
                                     sdk.ai.think → lib/policy.ts decide()
                                     swap (sdk.ai.execute) | Vesu supply/withdraw ──▶ session-signed tx
                                     waitForTransaction → log
"Stop" passkey prompt: revokeSession(key) ───────────────────────────────────────▶ session zeroed
```

## Run it

Requires Node 22, Postgres, a [Clerk](https://clerk.com) app and a [Chipi](https://dashboard.chipipay.com) org with AI credits.

```bash
cp .env.example .env.local   # fill it in
npm install
npm run dev
```

In the Chipi dashboard, register your Clerk instance's JWKS (with an `aud` rule) so Chipi accepts your users' tokens.

`vercel.json` calls `GET /api/tick` once a day, which is what Vercel Hobby allows. The endpoint needs no secret: the database lets each agent decide at most once per `TICK_INTERVAL_MINUTES` (default 1440), however often it is called. To decide more often, lower it and call the endpoint from any scheduler (QStash, GitHub Actions, `curl` in a loop).

```bash
npm run lint && npm run typecheck && npm test
```

## Code map

| Path | What |
|---|---|
| `lib/policy.ts` | The guard between the model and the wallet, and the on-chain caps |
| `lib/agent.ts` | One tick: think, decide, execute, wait for the receipt |
| `lib/brain.ts` | `sdk.ai.think` with the portfolio in USD and the strategy's risk |
| `lib/portfolio.ts`, `lib/vesu.ts` | Balances, prices, the Vesu USDC position and its calls |
| `lib/db.ts` | `agents` and `decisions` (created on first use) |
| `app/api/agents` | Hire (create the session), confirm or stop, and the dashboard's data |
| `app/api/tick` | The scheduler entry point |
| `app/onboarding`, `app/dashboard` | Passkey wallet, hiring, live status |

Built on `@chipi-stack/nextjs` and `@chipi-stack/backend` 14.14.

## License

[MIT](./LICENSE)
