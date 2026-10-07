# Module 15. Monitoring

An agent you cannot see is an agent you cannot trust. Everything worth watching is either on-chain (the truth) or in your database (the explanation).

## What to watch

| Signal | Source | Where Vela reads it |
|---|---|---|
| Session active, time and calls left | Chain: `getSessionData` | `GET /api/agents` → dashboard status |
| Spent in today's window, per token | Chain: `getSpendingPolicy` | Module 5's script; a good dashboard addition |
| Balances and Vesu position | Chain, via Chipi and RPC | `getPortfolio` |
| Every decision, reason, tx and result | Database: `decisions` | Activity feed (failures and crashed ticks in red) |
| What the AI cost | Database: `ai_cost_usd` | Dashboard "AI cost" |
| Ticks that crashed | `decisions` (`kind: error`) and server logs | Activity feed; `failed` in the `/api/tick` answer; Vercel logs, search `tick failed` |
| Agents gone silent | Database: `agents.last_tick_at` | `overdue` in the `/api/tick` answer (`countOverdueAgents`) |

Two rules:

- **When the chain and the database disagree, the chain wins.** The database records what Vela tried; the chain records what happened.
- **Alert on silence.** An agent that has not logged a decision in two intervals is a broken scheduler, not a calm market. `/api/tick` counts them as `overdue`; let your scheduler alert on it and on `failed`.

## Exercise

Add the window spending to the dashboard: in `GET /api/agents`, read `getSpendingPolicy` for USDC and return `spentInWindow` and `maxPerWindow`; show them as "today: $x of $y" in `components/dashboard/agent-status.tsx`.

## Test

Your feature: write the test for the new `GET` field first, mocking `getSpendingPolicy` the way `lib/__tests__/agent.test.ts` mocks the SDK.
