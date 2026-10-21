# Module 7. Stop, expire, renew

Delegation you cannot take back is not delegation. Vela gives you three ways to end it, and the agent notices each one by itself.

## The idea

- **Stop.** One passkey prompt: `revokeSession(key)` zeroes the session on-chain. From that block on, the key is worthless, even if someone copied it.
- **Expire.** After 7 days the wallet contract stops accepting the key. Nothing to do.
- **Run out.** After 1,000 calls, same.
- **Renew.** Hire again: a new session key replaces the old one (the server keeps one per user). The dashboard says why the agent stopped (expired on a date, out of calls, or stopped) and offers **Renew** with the same strategy and cap: one passkey prompt. It warns a day before the session ends, but only offers Renew once the agent stopped: hiring stores the new key before the passkey prompt, so a renewal abandoned halfway would otherwise stop a running agent.

The agent checks before every decision: if the session is not active on-chain, or the user's wallet changed, it marks itself stopped and does not think or trade.

## The code

- `app/dashboard/page.tsx`, `stop`: `revokeSession(agent.sessionPublicKey)`, then `PATCH { active: false }`. Stopping never needs proof: it is the safe direction.
- `lib/agent.ts`, step 1 of `runTick`: `getSessionData`; inactive → `setAgentActive(false)`, log, return.
- `lib/notices.ts`, `sessionNotice`: turns the agent's flag and the chain's session into `ending`, `expired`, `out-of-calls` or `stopped`. `components/dashboard/session-notice.tsx` shows it, with Renew (`useHireAgent`, module 6).

## Exercise

Stop your agent from the dashboard. Then read the session from the chain: `isActive` is false. Hire again and check that the new session has a new public key.

## Test

```bash
npx vitest run lib/__tests__/agent.test.ts -t stop
npx vitest run lib/__tests__/notices.test.ts -t sessionNotice
```
