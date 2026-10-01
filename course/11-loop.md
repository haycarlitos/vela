# Module 11. The autonomous loop

An agent that only acts when you click is a button. Something has to wake it up on a schedule, safely, even if that something calls twice.

## The idea

- **A scheduler** calls `GET /api/tick`. On Vercel's free plan, `vercel.json` runs it once a day. Any other scheduler (QStash, GitHub Actions, `curl` in a loop) can call it more often.
- **The endpoint is public.** No secret to set up. That is safe because of the next point.
- **Idempotency through the database.** `claimDueAgent` picks the agent that waited longest *and* marks it in the same atomic statement (`FOR UPDATE SKIP LOCKED`). Two calls at the same moment never get the same agent, and an agent runs at most once per `TICK_INTERVAL_MINUTES`, however often the endpoint is hit.
- **Time budget.** A serverless function has a deadline. The tick stops starting new agents after 90 seconds; the rest are still due and go first next time.
- **Self-stopping.** Each tick re-checks the session (module 7) and the deposit limit, so an agent never acts on a dead session or an oversized wallet.
- **Nothing private leaks.** The public answer lists outcomes only: no user ids, no error details.

## The code

- `app/api/tick/route.ts`: the loop.
- `lib/db.ts`, `claimDueAgent`: the atomic claim.
- `lib/config.ts`, `TICK_INTERVAL_MINUTES`.

## Exercise

Set `TICK_INTERVAL_MINUTES=60`, then call your endpoint twice in a row:

```bash
curl https://<your-project>.vercel.app/api/tick
curl https://<your-project>.vercel.app/api/tick
```

The first runs your agent; the second answers `{"ran":0,"outcomes":[]}`. Explain why with the SQL in `claimDueAgent`.

## Test

```bash
npx vitest run app/api/tick
```
