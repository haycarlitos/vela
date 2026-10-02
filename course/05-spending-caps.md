# Module 5. Spending caps

A session key limited to `approve` can still approve a thief for all your USDC. Spending caps close that gap: the wallet contract itself meters every token movement the session makes.

## The idea

A **spending policy** is set per session and per token: `maxPerCall`, `maxPerWindow` and `windowSeconds`. The wallet contract meters the calls that move or allow moving tokens (`transfer`, `approve`, `increase_allowance`) and rejects any that go over.

Rules Vela follows, and why:

- **Every token the wallet can hold gets a policy.** The function whitelist is not scoped to a contract (module 4), so an uncapped token is an unprotected token. Vela caps USDC, ETH, STRK and the Vesu vault's shares (`CAPPED_TOKENS`).
- **`maxPerWindow` is never 0.** On-chain, 0 means *no cap*, not "nothing allowed".
- **Caps are in base units at hire-time prices**, with headroom so a normal price move does not make a legal trade revert: 1.05× for USDC, 1.5× for ETH and STRK.
- **Per day = four trades.** One bad day costs at most four times your max trade per token.
- **Check what really moved.** On SHHH, a call the wallet refuses (over its cap, not whitelisted, or from a revoked session) comes back as succeeded without moving anything. The receipt's `Transfer` events are the truth (module 3).

```
maxTradeUsd = $5
USDC   per call 5.25 USDC      per day 21 USDC
ETH    per call $7.50 of ETH   per day $30 of ETH
STRK   per call $7.50 of STRK  per day $30 of STRK
vUSDC  1 base unit             (the agent never needs to approve shares)
```

## The code

- `spendingPolicies(maxTradeUsd, prices)` in `lib/policy.ts`.
- `PATCH /api/agents` reads each cap back from the chain (`getSpendingPolicy`) and refuses to activate an agent whose session has a token without a cap.

## Exercise

Hire with a $1 max trade. Then read the USDC policy straight from the chain, before and after a trade, with a few lines of Node (`.env.local` loaded):

```ts
import { ChipiServerSDK } from "@chipi-stack/backend";

const sdk = new ChipiServerSDK({
  apiPublicKey: process.env.NEXT_PUBLIC_CHIPI_API_KEY!,
  apiSecretKey: process.env.CHIPI_SECRET_KEY!,
});
console.log(
  await sdk.sessions.getSpendingPolicy({
    walletAddress: "0x…your wallet",
    sessionPublicKey: "0x…from the dashboard's data (GET /api/agents)",
    token: "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
  })
);
```

`spentInWindow` grows with each trade and never passes `maxPerWindow`.

## Test

```bash
npx vitest run lib/__tests__/policy.test.ts -t spendingPolicies
```
