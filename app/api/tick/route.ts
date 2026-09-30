import { NextResponse } from "next/server";
import { runTick, type TickResult } from "@/lib/agent";
import { listActiveAgents, touchAgent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Agents fetched per run. */
const BATCH = 10;

/**
 * Stop starting new agents after this long: one agent can wait up to ~3.5 min
 * for its receipts in the worst case, and the function ends at maxDuration.
 * Agents not reached run first next time (listActiveAgents orders by updated_at).
 */
const START_BUDGET_MS = 90_000;

/**
 * GET /api/tick: one decision for each active agent (Vercel Cron, QStash, or
 * any scheduler that sends `Authorization: Bearer $CRON_SECRET`). Agents that
 * waited longest go first.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const agents = await listActiveAgents(BATCH);
  const results: TickResult[] = [];
  // Sequential on purpose: one failing agent must not take the others down,
  // and the AI API rate limit is per org.
  for (const agent of agents) {
    if (Date.now() - startedAt > START_BUDGET_MS) break;
    try {
      await touchAgent(agent.user_id);
      results.push(await runTick(agent));
    } catch (err) {
      results.push({
        userId: agent.user_id,
        outcome: "failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return NextResponse.json({ ran: results.length, results });
}
