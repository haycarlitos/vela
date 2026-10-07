# Module 0. Setup in 15 minutes

By the end you have your own Vela running at `https://<your-project>.vercel.app`, with its own database, and you know what each piece does.

## The pieces

```
 Your browser                    Your Vela (Vercel)                 Chipi                    Starknet
 ────────────                    ──────────────────                 ─────                    ────────
 passkey ── sign in ──────────▶  Better Auth (accounts)
                                 /api/auth/jwks ◀──── checks your users' tokens ──── Chipi API
 wallet key (encrypted) ◀──────────────────────────── stores the ciphertext ────────
                                 Postgres (Neon): agents, decisions
                                 /api/tick: the agent ── AI decisions, gasless txs ─▶ Chipi ──▶ wallet contract
```

- **Vercel** hosts the app. **Neon** is the Postgres database Vercel creates for you.
- **Better Auth** runs inside the app: accounts are passkeys, no email or password.
- **Chipi** gives you the wallet, the AI API and a paymaster that pays gas. It is the only account you create.
- **Starknet** is where the money lives. Everything in this course runs on mainnet.

## Steps

1. **Chipi keys.** Sign up at [dashboard.chipipay.com](https://dashboard.chipipay.com) and create an API key. You get a public key (`pk_...`) and a secret key (`sk_...`). Production keys call the real AI models (top up a few dollars of AI credits). Development keys (`pk_dev_...`) answer every AI call with a free sample decision, which is enough to wire everything up.
2. **Deploy.** Click the button and paste the two keys when Vercel asks:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fchipi-pay%2Fvela&project-name=vela&repository-name=vela&env=NEXT_PUBLIC_CHIPI_API_KEY%2CCHIPI_SECRET_KEY&envDescription=Your+two+Chipi+API+keys+%28public+pk_+and+secret+sk_%29&envLink=https%3A%2F%2Fdashboard.chipipay.com&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

   Vercel copies the repo to your GitHub, creates a Neon database (that sets `DATABASE_URL`) and deploys. Tables are created the first time they are used.
3. **Tell Chipi who your users are.** In the Chipi dashboard, set your API key's JWKS to `https://<your-project>.vercel.app/api/auth/jwks` and pick the **Better Auth** provider. Chipi now accepts the tokens your app signs for its users (module 2 explains how).
4. **Try it.** Open your app, create an account with a passkey, create your wallet, send it $5–10 of USDC on Starknet, and hire the agent with a $1 cap.

Everything else has a default: the encryption keys are derived from your Chipi secret key, the agent decides once a day (module 11 shows how to make it hourly), and it refuses to manage wallets above $100. `.env.example` lists every optional setting.

## Run it on your machine

```bash
git clone https://github.com/<you>/vela && cd vela
cp .env.example .env.local    # your two Chipi keys + a Postgres URL
npm install
npm run dev
```

Passkeys are bound to a domain: one created on `localhost` only works on `localhost`. Chipi cannot reach `localhost` to check tokens, so for wallet steps use your deployed app (or a tunnel and `BETTER_AUTH_URL`).

## Check

```bash
npm run lint && npm run typecheck && npm test
```

All green means your copy matches the course. Next: [what a wallet really is](./01-wallets.md).
