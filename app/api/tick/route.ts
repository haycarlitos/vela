import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runTick, type TickResult } from "@/lib/agent";
import { claimDueAgent, countOverdueAgents, logDecision } from "@/lib/db";
import { TICK_INTERVAL_MINUTES } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Agents run per call. */
const BATCH = 10;

/**
 * Stop starting new agents after this long: one agent can wait up to ~3.5 min
 * for its receipts in the worst case, and the function ends at maxDuration.
 * Agents not reached are still due, so the next call runs them first.
 */
const START_BUDGET_MS = 90_000;

/**
 * Schedulers drift (Vercel Hobby fires anywhere within the hour), so an agent
 * is due a little before a full interval has passed.
 */
const MIN_GAP_SECONDS = TICK_INTERVAL_MINUTES * 60 * 0.9;

/** An active agent with no tick for two intervals is overdue: something stopped calling or keeps failing. */
const OVERDUE_SECONDS = TICK_INTERVAL_MINUTES * 60 * 2;

/**
 * With CRON_SECRET set, only callers sending `Authorization: Bearer <CRON_SECRET>`
 * get through (Vercel Cron sends it by itself). Without it the route is public:
 * the database claim (`claimDueAgent`) makes extra calls harmless, each agent
 * runs at most once per TICK_INTERVAL_MINUTES, but anyone can pick the moment
 * and add load.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * GET /api/tick: one decision for each agent that is due. Vercel Cron,
 * Trigger.dev, QStash or a plain curl can call it.
 *
 * The answer is safe to show anyone: outcomes and counts, no user ids or error
 * details. `failed` (agents whose tick threw: an outage, not a trade the wallet
 * refused, which is a normal "failed" outcome) and `overdue` (active agents with
 * no tick for two intervals) are what a scheduler alerts on.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  const results: TickResult[] = [];
  let failed = 0;
  // Sequential on purpose: one failing agent must not take the others down,
  // and the AI API rate limit is per org.
  while (results.length < BATCH && Date.now() - startedAt < START_BUDGET_MS) {
    const agent = await claimDueAgent(MIN_GAP_SECONDS);
    if (!agent) break;
    try {
      results.push(await runTick(agent));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`tick failed for ${agent.user_id}:`, err);
      // In the user's activity too, not only in the logs: a silent failure looks like a quiet agent.
      await logDecision({ userId: agent.user_id, kind: "error", reason: `Tick failed: ${detail}`, success: false }).catch(
        (logErr: unknown) => console.error(`could not record the failed tick for ${agent.user_id}:`, logErr)
      );
      failed++;
      results.push({ userId: agent.user_id, outcome: "failed", detail });
    }
  }
  const overdue = await countOverdueAgents(OVERDUE_SECONDS);
  return NextResponse.json({ ran: results.length, outcomes: results.map((r) => r.outcome), failed, overdue });
}
