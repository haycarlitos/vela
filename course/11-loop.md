# Module 11. The autonomous loop

An agent that only acts when you click is a button. Something has to wake it up on a schedule, safely, even if that something calls twice.

## The idea

- **A scheduler** calls `GET /api/tick`. On Vercel's free plan, `vercel.json` runs it once a day. Any other scheduler (Trigger.dev, QStash, GitHub Actions, a cron service) can call it more often; set `TICK_INTERVAL_MINUTES` to match.
- **Public by default, locked in production.** With no `CRON_SECRET` the endpoint is public, which is safe because of the next point. In production set `CRON_SECRET`: only callers sending `Authorization: Bearer <CRON_SECRET>` get through, so nobody else picks when your agents run or adds load. Vercel Cron sends that header by itself.
- **Idempotency through the database.** `claimDueAgent` picks the agent that waited longest *and* marks it in the same atomic statement (`FOR UPDATE SKIP LOCKED`). Two calls at the same moment never get the same agent, and an agent runs at most once per `TICK_INTERVAL_MINUTES`, however often the endpoint is hit.
- **Time budget.** A serverless function has a deadline. The tick stops starting new agents after 90 seconds; the rest are still due and go first next time.
- **Self-stopping.** Each tick re-checks the session (module 7) and the deposit limit, so an agent never acts on a dead session or an oversized wallet.
- **Nothing private leaks.** The answer lists outcomes and counts only: no user ids, no error details.
- **It tells the scheduler when to worry.** `failed` counts agents whose tick crashed (an outage; a trade the wallet refused is a normal outcome), and `overdue` counts active agents with no tick for two intervals. A crash is also written to the user's activity as an `error` row.

## The code

- `app/api/tick/route.ts`: the loop.
- `lib/db.ts`, `claimDueAgent`: the atomic claim; `countOverdueAgents`: the silence check.
- `lib/config.ts`, `TICK_INTERVAL_MINUTES`.

## Exercise

Set `TICK_INTERVAL_MINUTES=60`, then call your endpoint twice in a row:

```bash
curl https://<your-project>.vercel.app/api/tick
curl https://<your-project>.vercel.app/api/tick
```

The first runs your agent; the second answers `{"ran":0,"outcomes":[],"failed":0,"overdue":0}`. Explain why with the SQL in `claimDueAgent`.

Then set `CRON_SECRET` and call it again without the header (`401`) and with `-H "Authorization: Bearer $CRON_SECRET"`. Finally, schedule it hourly from any external scheduler and make it alert when `failed` or `overdue` is above zero.

## Test

```bash
npx vitest run app/api/tick
```
