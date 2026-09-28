# Vela

**Set sail. Let AI navigate.** An open-source DeFi agent for your self-custodial Starknet wallet.

- **Your wallet, your key.** A SHHH smart wallet secured by your passkey (WebAuthn PRF). Neither Vela nor Chipi can decrypt it.
- **One passkey prompt to hire the agent, one to stop it.** The agent gets a session key the wallet contract limits by itself: which functions, how many calls, for how long, and how much USDC, ETH and STRK per trade and per day.
- **It thinks with Chipi's AI API** (`sdk.ai.think`, live market signals and yields), and a deterministic policy decides what actually happens.
- **It pays for every decision with x402** ($0.001 in USDC), verified on-chain.
- **No gas.** Every transaction is sponsored by Chipi's paymaster.

> **Beta.** SHHH V8.4 is pending its external audit. Vela manages wallets up to $100. The agent can lose money within its limits. See [SECURITY.md](./SECURITY.md).

## How it works

```
Browser                                   Vela server                              Starknet
───────                                   ───────────                              ────────
Clerk sign-in → passkey (PRF) → SHHH wallet ─────────────────────────────────────▶ deploy (gasless)
"Hire agent" ──POST /api/agents──▶ createSessionKey (encrypted with VELA_SESSION_SECRET)
passkey prompt: registerSession(key, whitelist, caps) ──────────────────────────▶ session + spending policies, one tx
             ──PATCH /api/agents──▶ waits for the tx, checks the session on-chain, activates
                                   cron → /api/tick, for each active agent:
                                     session live? → portfolio (sdk.ai.prices + balances + Vesu)
                                     pay $0.001 (session-signed USDC transfer) → SessionTxVerifier
                                     sdk.ai.think → lib/policy.ts decide()
                                     swap (sdk.ai.execute) | Vesu supply/withdraw ──▶ session-signed tx
                                     waitForTransaction → log
"Stop" passkey prompt: revokeSession(key) ───────────────────────────────────────▶ session zeroed
```

Other agents can buy the same decisions: `POST /api/think` with an x402 payment (see `lib/x402.ts`).

## Run it

Requires Node 22, Postgres, a [Clerk](https://clerk.com) app and a [Chipi](https://dashboard.chipipay.com) org with AI credits.

```bash
cp .env.example .env.local   # fill it in
npm install
npm run dev
```

In the Chipi dashboard, register your Clerk instance's JWKS (with an `aud` rule) so Chipi accepts your users' tokens.

Schedule `GET /api/tick` with `Authorization: Bearer $CRON_SECRET`. `vercel.json` runs it every 30 minutes on Vercel Pro; on Hobby, use QStash or any external scheduler.

```bash
npm run lint && npm run typecheck && npm test
```

## Code map

| Path | What |
|---|---|
| `lib/policy.ts` | The guard between the model and the wallet, and the on-chain caps |
| `lib/agent.ts` | One tick: pay, think, decide, execute, wait for the receipt |
| `lib/brain.ts` | `sdk.ai.think` with the portfolio in USD and the strategy's risk |
| `lib/x402.ts`, `lib/payments.ts` | x402 terms, the `X-PAYMENT` header, on-chain verification |
| `lib/portfolio.ts`, `lib/vesu.ts` | Balances, prices, the Vesu USDC position and its calls |
| `lib/db.ts` | `agents`, `decisions`, `x402_payments` (created on first use) |
| `app/api/agents` | Hire (create the session), confirm or stop, and the dashboard's data |
| `app/api/tick`, `app/api/think` | The scheduler entry point and the paid decision endpoint |
| `app/onboarding`, `app/dashboard` | Passkey wallet, hiring, live status |
| `app/demo` | The marketing demo with sample data |

Built on `@chipi-stack/nextjs` and `@chipi-stack/backend` 14.14.

## License

[MIT](./LICENSE)
