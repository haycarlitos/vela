# Module 4. Session keys

You want an agent to trade for you while you sleep. Giving it your key would let it do anything, forever. A **session key** is a second key your wallet contract accepts with limited powers, for a limited time.

## The idea

Your wallet contract keeps, for each session key it knows:

| Limit | Vela's value | Where |
|---|---|---|
| Expiry | 7 days | `SESSION_SECONDS` in `lib/config.ts` |
| Number of calls | 1,000 | `SESSION_MAX_CALLS` |
| Allowed functions | `approve`, `multi_route_swap`, `deposit_to_self`, `withdraw_to_self` | `SESSION_ENTRYPOINTS` |
| Spending caps per token | module 5 | `spendingPolicies` |

The owner key (your passkey) registers the session once. From then on the agent signs with the session key and **never asks you again**.

**The catch: allowed functions are names, not "this function on this contract".** The wallet compares the function selector only. If `approve` is allowed, `approve` on *any* token is allowed. That is why module 5 caps every token the wallet can hold, and why module 13 exists.

```
              owner key (passkey)                     session key (on Vela's server)
can do:       everything, forever                     4 function names, 1,000 calls, 7 days, capped spending
asked for:    hire, stop                              every agent trade
```

## The code

- `app/api/agents/route.ts`, `POST`: `chipi().sessions.createSessionKey(...)` makes the key on the server. The private half is encrypted with `sessionSecret()` (`lib/chipi.ts`, derived from your Chipi secret key) and stored in Postgres; it never reaches the browser. The browser gets the public half and the limits to register.
- `lib/config.ts`: the four limits above, each with a comment on why.

## Exercise

After hiring (module 6), read the session back from the chain: the dashboard calls `getSessionData` and shows the time and calls left. Compare them with the table above.

## Test

```bash
npx vitest run lib/__tests__/chipi.test.ts
```
