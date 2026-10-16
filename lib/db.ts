import "server-only";
import pg from "pg";
import type { Strategy } from "./strategies";
import type { TrustedRole, TrustedWalletRecord } from "./trusted-wallets";

// Any Postgres (Neon, Railway, Supabase, Vercel Postgres) via DATABASE_URL.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

let schemaReady: Promise<void> | null = null;

/** Idempotent. Runs once per process, on first use; there is no public init route. */
function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    // The first Vela kept a `decisions` table with no user_id. CREATE TABLE IF
    // NOT EXISTS would keep it and the index below would fail, so move it aside
    // (kept as decisions_v0, nothing is deleted).
    await pool.query(`
      DO $$ BEGIN
        IF to_regclass('decisions') IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'decisions' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE decisions RENAME TO decisions_v0;
        END IF;
      END $$;
    `);
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
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_tick_at TIMESTAMPTZ;

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

      CREATE TABLE IF NOT EXISTS trusted_wallets (
        user_id TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        signer_address TEXT NOT NULL,
        wallet_name TEXT NOT NULL,
        stark_pubkey TEXT NOT NULL,
        role TEXT NOT NULL,
        propose_tx_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, signer_address)
      );
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

/**
 * Claims the active agent that waited longest, if its last tick is at least
 * `minGapSeconds` old. Atomic: two concurrent callers never get the same agent,
 * so /api/tick can be public and still runs each agent at most once per gap.
 */
export async function claimDueAgent(minGapSeconds: number): Promise<AgentRow | null> {
  const { rows } = await query<AgentRow>(
    `UPDATE agents SET last_tick_at = NOW()
     WHERE user_id = (
       SELECT user_id FROM agents
       WHERE active AND (last_tick_at IS NULL OR last_tick_at <= NOW() - make_interval(secs => $1))
       ORDER BY last_tick_at ASC NULLS FIRST
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [minGapSeconds]
  );
  return rows[0] ?? null;
}

/**
 * Active agents with no tick for `maxAgeSeconds` (counted from activation when
 * they never ran): the scheduler stopped calling, or their ticks keep failing
 * before the claim. A count only, so /api/tick can report it without user ids.
 */
export async function countOverdueAgents(maxAgeSeconds: number): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM agents
     WHERE active AND COALESCE(last_tick_at, updated_at) < NOW() - make_interval(secs => $1)`,
    [maxAgeSeconds]
  );
  return Number(rows[0]?.n ?? 0);
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

// ---------- trusted wallets ----------

interface TrustedWalletRow {
  signer_address: string;
  wallet_name: string;
  stark_pubkey: string;
  role: TrustedRole;
  propose_tx_hash: string | null;
}

function toTrustedWallet(row: TrustedWalletRow): TrustedWalletRecord {
  return {
    signerAddress: row.signer_address,
    walletName: row.wallet_name,
    starkPubkey: row.stark_pubkey,
    role: row.role,
    proposeTxHash: row.propose_tx_hash,
  };
}

export async function listTrustedWallets(userId: string): Promise<TrustedWalletRecord[]> {
  const { rows } = await query<TrustedWalletRow>(
    `SELECT signer_address, wallet_name, stark_pubkey, role, propose_tx_hash
     FROM trusted_wallets WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  return rows.map(toTrustedWallet);
}

/** Saving the same wallet again (new key or role) starts over: any earlier proposal is forgotten. */
export async function saveTrustedWallet(userId: string, walletAddress: string, record: Omit<TrustedWalletRecord, "proposeTxHash">): Promise<void> {
  await query(
    `INSERT INTO trusted_wallets (user_id, wallet_address, signer_address, wallet_name, stark_pubkey, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, signer_address) DO UPDATE SET
       wallet_address = EXCLUDED.wallet_address,
       wallet_name = EXCLUDED.wallet_name,
       stark_pubkey = EXCLUDED.stark_pubkey,
       role = EXCLUDED.role,
       propose_tx_hash = NULL`,
    [userId, walletAddress, record.signerAddress, record.walletName, record.starkPubkey, record.role]
  );
}

/** `null` forgets an expired proposal. Returns false if the user has no such trusted wallet. */
export async function setTrustedWalletProposal(userId: string, signerAddress: string, txHash: string | null): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE trusted_wallets SET propose_tx_hash = $3 WHERE user_id = $1 AND signer_address = $2`,
    [userId, signerAddress, txHash]
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteTrustedWallet(userId: string, signerAddress: string): Promise<void> {
  await query(`DELETE FROM trusted_wallets WHERE user_id = $1 AND signer_address = $2`, [userId, signerAddress]);
}
