import "server-only";
import pg from "pg";
import type { Strategy } from "./strategies";

// Any Postgres (Neon, Railway, Supabase, Vercel Postgres) via DATABASE_URL.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

let schemaReady: Promise<void> | null = null;

/** Idempotent. Runs once per process, on first use; there is no public init route. */
function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agents (
        user_id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        strategy TEXT NOT NULL,
        max_trade_usd NUMERIC NOT NULL,
        session_public_key TEXT NOT NULL,
        session_encrypted_key TEXT NOT NULL,
        session_valid_until BIGINT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS agents_active ON agents (active) WHERE active;

      CREATE TABLE IF NOT EXISTS decisions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        kind TEXT NOT NULL,
        from_token TEXT,
        to_token TEXT,
        amount_usd NUMERIC,
        reason TEXT NOT NULL,
        tx_hash TEXT,
        success BOOLEAN,
        payment_tx_hash TEXT,
        ai_cost_usd NUMERIC
      );
      CREATE INDEX IF NOT EXISTS decisions_user ON decisions (user_id, created_at DESC);
    `);
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

async function query<T extends pg.QueryResultRow>(text: string, params?: unknown[]) {
  await ensureSchema();
  return pool.query<T>(text, params);
}

// ---------- agents ----------

export interface AgentRow {
  user_id: string;
  wallet_address: string;
  strategy: Strategy;
  max_trade_usd: string;
  session_public_key: string;
  session_encrypted_key: string;
  session_valid_until: string;
  active: boolean;
}

/** A new session replaces the previous one; it starts inactive until the chain confirms it. */
export async function upsertPendingAgent(agent: {
  userId: string;
  walletAddress: string;
  strategy: Strategy;
  maxTradeUsd: number;
  sessionPublicKey: string;
  sessionEncryptedKey: string;
  sessionValidUntil: number;
}): Promise<void> {
  await query(
    `INSERT INTO agents (user_id, wallet_address, strategy, max_trade_usd, session_public_key,
                         session_encrypted_key, session_valid_until, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
     ON CONFLICT (user_id) DO UPDATE SET
       wallet_address = EXCLUDED.wallet_address,
       strategy = EXCLUDED.strategy,
       max_trade_usd = EXCLUDED.max_trade_usd,
       session_public_key = EXCLUDED.session_public_key,
       session_encrypted_key = EXCLUDED.session_encrypted_key,
       session_valid_until = EXCLUDED.session_valid_until,
       active = FALSE,
       updated_at = NOW()`,
    [
      agent.userId,
      agent.walletAddress,
      agent.strategy,
      agent.maxTradeUsd,
      agent.sessionPublicKey,
      agent.sessionEncryptedKey,
      agent.sessionValidUntil,
    ]
  );
}

export async function getAgent(userId: string): Promise<AgentRow | null> {
  const { rows } = await query<AgentRow>(`SELECT * FROM agents WHERE user_id = $1`, [userId]);
  return rows[0] ?? null;
}

/** Only flips the flag for the session the caller is talking about, so a stale request cannot re-activate an old key. */
export async function setAgentActive(userId: string, sessionPublicKey: string, active: boolean): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE agents SET active = $3, updated_at = NOW() WHERE user_id = $1 AND session_public_key = $2`,
    [userId, sessionPublicKey, active]
  );
  return (rowCount ?? 0) > 0;
}

/** Moves an agent to the back of the tick queue. */
export async function touchAgent(userId: string): Promise<void> {
  await query(`UPDATE agents SET updated_at = NOW() WHERE user_id = $1`, [userId]);
}

export async function listActiveAgents(limit: number): Promise<AgentRow[]> {
  const { rows } = await query<AgentRow>(
    `SELECT * FROM agents WHERE active ORDER BY updated_at ASC LIMIT $1`,
    [limit]
  );
  return rows;
}

// ---------- decisions ----------

export interface DecisionRow {
  id: number;
  created_at: Date;
  kind: string;
  from_token: string | null;
  to_token: string | null;
  amount_usd: string | null;
  reason: string;
  tx_hash: string | null;
  success: boolean | null;
  payment_tx_hash: string | null;
  ai_cost_usd: string | null;
}

export async function logDecision(d: {
  userId: string;
  kind: string;
  fromToken?: string;
  toToken?: string;
  amountUsd?: number;
  reason: string;
  txHash?: string;
  success?: boolean;
  paymentTxHash?: string;
  aiCostUsd?: number;
}): Promise<void> {
  await query(
    `INSERT INTO decisions (user_id, kind, from_token, to_token, amount_usd, reason, tx_hash, success,
                            payment_tx_hash, ai_cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      d.userId,
      d.kind,
      d.fromToken ?? null,
      d.toToken ?? null,
      d.amountUsd ?? null,
      d.reason.slice(0, 1_000),
      d.txHash ?? null,
      d.success ?? null,
      d.paymentTxHash ?? null,
      d.aiCostUsd ?? null,
    ]
  );
}

export async function recentDecisions(userId: string, limit = 30): Promise<DecisionRow[]> {
  const { rows } = await query<DecisionRow>(
    `SELECT * FROM decisions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}
