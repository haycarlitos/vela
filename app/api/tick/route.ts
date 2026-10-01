import { NextResponse } from "next/server";
import { runTick, type TickResult } from "@/lib/agent";
import { claimDueAgent } from "@/lib/db";
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

/**
 * GET /api/tick: one decision for each agent that is due. Public on purpose:
 * Vercel Cron, QStash or a plain curl can call it with no secret. The database
 * claim (`claimDueAgent`) makes extra calls harmless: each agent runs at most
 * once per TICK_INTERVAL_MINUTES, however often this is called.
 */
export async function GET() {
  const startedAt = Date.now();
  const results: TickResult[] = [];
  // Sequential on purpose: one failing agent must not take the others down,
  // and the AI API rate limit is per org.
  while (results.length < BATCH && Date.now() - startedAt < START_BUDGET_MS) {
    const agent = await claimDueAgent(MIN_GAP_SECONDS);
    if (!agent) break;
    try {
      results.push(await runTick(agent));
    } catch (err) {
      console.error(`tick failed for ${agent.user_id}:`, err);
      results.push({ userId: agent.user_id, outcome: "failed", detail: err instanceof Error ? err.message : String(err) });
    }
  }
  // Anyone can call this, so the answer carries outcomes only, no user ids or
  // error details. Each decision is in the `decisions` table and the logs.
  return NextResponse.json({ ran: results.length, outcomes: results.map((r) => r.outcome) });
}
