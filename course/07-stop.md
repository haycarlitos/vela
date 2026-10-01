# Module 7. Stop, expire, renew

Delegation you cannot take back is not delegation. Vela gives you three ways to end it, and the agent notices each one by itself.

## The idea

- **Stop.** One passkey prompt: `revokeSession(key)` zeroes the session on-chain. From that block on, the key is worthless, even if someone copied it.
- **Expire.** After 7 days the wallet contract stops accepting the key. Nothing to do.
- **Run out.** After 1,000 calls, same.
- **Renew.** Hire again: a new session key replaces the old one (the server keeps one per user).

The agent checks before every decision: if the session is not active on-chain, or the user's wallet changed, it marks itself stopped and does not think or trade.

## The code

- `app/dashboard/page.tsx`, `stop`: `revokeSession(agent.sessionPublicKey)`, then `PATCH { active: false }`. Stopping never needs proof: it is the safe direction.
- `lib/agent.ts`, step 1 of `runTick`: `getSessionData`; inactive → `setAgentActive(false)`, log, return.

## Exercise

Stop your agent from the dashboard. Then read the session from the chain: `isActive` is false. Hire again and check that the new session has a new public key.

## Test

```bash
npx vitest run lib/__tests__/agent.test.ts -t stop
```
