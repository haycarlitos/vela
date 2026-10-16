# Vela

**Learn blockchain and AI by building an agent you can trust with money.** An open-source course and a working DeFi agent on a self-custodial Starknet wallet, built with [Chipi](https://chipipay.com).

- **Your wallet, your key.** A SHHH smart wallet secured by your passkey (WebAuthn PRF). Neither Vela nor Chipi can decrypt it.
- **Delegate once.** One passkey prompt hires the agent, one stops it. In between, the agent signs with a session key the wallet contract limits by itself: which functions, how many calls, for how long, and how much USDC, ETH and STRK per trade and per day.
- **The model advises, code decides.** The agent thinks with Chipi's AI API (`sdk.ai.think`, live market signals and yields), and a deterministic policy (`lib/policy.ts`) decides what actually reaches the chain.
- **No gas.** Every transaction is sponsored by Chipi's paymaster.

**New here? Start with the [course](./course/README.md):** 19 short modules, from "what is a wallet" to writing a Cairo contract, each with a mainnet exercise and a test.

> SHHH V8.4 is pending its external audit. By default the agent manages wallets up to $100 (`MAX_DEPOSIT_USD`). The agent can lose money within its limits. See [SECURITY.md](./SECURITY.md).

## How Vela works

1. **You open a wallet with a passkey** (face, fingerprint or device PIN), or sign in with the Starknet wallet you already use (Bramble, Braavos, Ready). The wallet is a smart contract on Starknet; its key is encrypted with your passkey, so only you can use it.
2. **You add a few dollars of USDC.**
3. **You hire the agent with one approval.** That approval gives the agent its own key, a *session key*, and writes its limits into your wallet contract: which functions it may call, how much USDC, ETH and STRK per trade and per day, and when it expires (7 days).
4. **The agent runs on a schedule.** Each time, it reads your balances and market data, asks an AI model for one decision, and checks that decision against fixed rules in code (`lib/policy.ts`). Only a decision that passes becomes a transaction: a swap on AVNU, or USDC into a Vesu vault. If the model is wrong, the rules hold; if the rules were wrong, the wallet contract still refuses anything past your caps.
5. **You watch, stop and withdraw.** The dashboard shows every decision with its reason and transaction. One approval revokes the agent's key, and withdrawals go back to your own wallet. You never pay gas.

### Under the hood

```
Browser                                   Vela server                              Starknet
───────                                   ───────────                              ────────
passkey account → passkey (PRF) → SHHH wallet ───────────────────────────────────────────▶ deploy (gasless)
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

## Ship your first agent

- **What you need to know:** read TypeScript and run `npm`. No blockchain or AI experience.
- **Accounts:** [Chipi](https://dashboard.chipipay.com) (wallets, AI API, gas) and Vercel, which creates the Postgres database for you.
- **Money:** $5–10 of USDC on Starknet to try it, plus a few dollars of Chipi AI credits. A development key (`pk_dev_...`) answers AI calls with a free sample decision, enough to wire everything up. Gas is sponsored.
- **About 15 minutes** to your own running copy: [module 0](./course/00-setup.md) is a Deploy button, two keys and one setting in the Chipi dashboard.
- **Then the [course](./course/README.md)**, at your pace: 19 modules in six parts (blockchain from zero, delegating without handing over keys, AI that acts, your first Cairo contract, running it safely, bringing your own wallet and adding it as a backup key). Each one names the 1–3 files it covers, has an exercise on mainnet with cents, and a test that passes when you got it right. Deploy first and read along, or rebuild the files yourself.
- **The model** is Chipi's AI API. [Module 8](./course/08-model.md#using-your-own-model-key) shows how a fork switches to its own provider key, and what it gives up.

## Run it

Requires Node 22, Postgres and a [Chipi](https://dashboard.chipipay.com) org with AI credits. Accounts are passkeys ([Better Auth](https://better-auth.com), inside the app): there is no other provider to sign up for.

```bash
cp .env.example .env.local   # fill it in
npm install
npm run dev
```

In the Chipi dashboard, set your API key's JWKS to `https://<your-app>/api/auth/jwks` with the **Better Auth** provider, so Chipi accepts your users' tokens. Tables are created on first use.

`vercel.json` calls `GET /api/tick` once a day, which is what Vercel Hobby allows. The database lets each agent decide at most once per `TICK_INTERVAL_MINUTES` (default 1440), however often the endpoint is called. To decide more often, lower it (e.g. `60`) and call the endpoint from any scheduler: Trigger.dev, QStash, GitHub Actions, a cron service.

Set `CRON_SECRET` in production: the endpoint then answers only callers sending `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it by itself; give your scheduler the same header). The answer carries `failed` (agents whose tick crashed) and `overdue` (active agents with no tick for two intervals): have your scheduler alert when either is above zero.

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
| `lib/auth.ts`, `lib/auth-client.ts` | Passkey accounts and the JWT Chipi accepts (Better Auth) |
| `app/api/agents` | Hire (create the session), confirm or stop, and the dashboard's data |
| `app/api/tick` | The scheduler entry point |
| `app/onboarding`, `app/dashboard` | Passkey wallet, hiring, live status |

Built on `@chipi-stack/nextjs` and `@chipi-stack/backend` 14.16.

## License

[MIT](./LICENSE)
