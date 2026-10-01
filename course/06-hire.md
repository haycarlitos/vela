# Module 6. Hire the agent with one prompt

Everything from modules 4 and 5 goes on-chain in a single transaction, approved with one passkey prompt. Then the server checks the chain before it trusts anything.

## The idea

```
browser                               server (/api/agents)                         Starknet
───────                               ────────────────────                         ────────
"Hire" ──── POST {strategy, max} ───▶ checks the wallet is under MAX_DEPOSIT_USD
                                      creates the session key, stores it encrypted
         ◀── public key + limits ────
passkey prompt: registerSession(key, whitelist, caps) ─────────────────────────▶ one tx: session + policies
         ──── PATCH {txHash} ───────▶ waits for the receipt
                                      getSessionData: active?
                                      getSpendingPolicy per token: capped?
                                      only then: agent active
```

Why not trust the browser's "done"? Because the browser could be buggy, outdated or modified. The chain is the only source of truth: the server reads the session and every cap back before the agent may act.

## The code

- `components/onboarding/configure-agent.tsx`, `handleHire`: the three steps above. `useChipiSession({ wallet, getEncryptKey })`: `getEncryptKey` unlocks the wallet passkey (the one prompt). It passes `wallet.credentialId`, so it works on any device with that passkey.
- `app/api/agents/route.ts`: `POST` (create the session, return the limits) and `PATCH` (verify on-chain, then activate).

## Exercise

Hire your agent with a $1 max trade and the Balanced strategy. Count the prompts: one. Open the hire transaction on Voyager and find the session registration and the spending policies in it.

## Test

There is no unit test for the browser step; the on-chain checks are what make it safe. Read `PATCH` in `app/api/agents/route.ts` and list every way it can refuse to activate.
