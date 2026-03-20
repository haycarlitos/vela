import pg from "pg";

// Connection pool — works with any Postgres provider (Railway, Neon, Supabase, etc.)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : undefined,
});

async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

// Initialize database tables
export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS decisions (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      action TEXT NOT NULL,
      pair TEXT,
      amount_usd DECIMAL,
      entry_price DECIMAL,
      quote_price_impact DECIMAL,
      reasoning TEXT,
      tx_hash TEXT,
      x402_cost DECIMAL DEFAULT 0.001,
      outcome TEXT DEFAULT 'open'
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      total_value_usd DECIMAL,
      usdc_balance DECIMAL,
      eth_balance DECIMAL,
      strk_balance DECIMAL,
      vesu_deposited DECIMAL,
      x402_spent_total DECIMAL,
      pnl_usd DECIMAL,
      pnl_pct DECIMAL
    )
  `);
}

// Decision CRUD
export interface Decision {
  id: number;
  created_at: Date;
  action: string;
  pair: string | null;
  amount_usd: number | null;
  entry_price: number | null;
  quote_price_impact: number | null;
  reasoning: string | null;
  tx_hash: string | null;
  x402_cost: number;
  outcome: string;
}

export async function logDecision(decision: {
  action: string;
  pair?: string;
  amount_usd?: number;
  entry_price?: number;
  quote_price_impact?: number;
  reasoning: string;
  tx_hash?: string;
}) {
  const result = await query(
    `INSERT INTO decisions (action, pair, amount_usd, entry_price, quote_price_impact, reasoning, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      decision.action,
      decision.pair ?? null,
      decision.amount_usd ?? null,
      decision.entry_price ?? null,
      decision.quote_price_impact ?? null,
      decision.reasoning,
      decision.tx_hash ?? null,
    ],
  );
  return result.rows[0] as Decision;
}

export async function getRecentDecisions(limit = 20): Promise<Decision[]> {
  const result = await query(
    `SELECT * FROM decisions ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows as Decision[];
}

export async function markOutcome(id: number, outcome: "profit" | "loss") {
  await query(`UPDATE decisions SET outcome = $1 WHERE id = $2`, [outcome, id]);
}

export async function getOpenSwapDecisions(): Promise<Decision[]> {
  const result = await query(
    `SELECT * FROM decisions WHERE outcome = 'open' AND action = 'swap' ORDER BY created_at DESC`,
  );
  return result.rows as Decision[];
}

// Snapshot CRUD
export interface Snapshot {
  id: number;
  created_at: Date;
  total_value_usd: number;
  usdc_balance: number;
  eth_balance: number;
  strk_balance: number;
  vesu_deposited: number;
  x402_spent_total: number;
  pnl_usd: number;
  pnl_pct: number;
}

export async function logSnapshot(snapshot: {
  total_value_usd: number;
  usdc_balance: number;
  eth_balance: number;
  strk_balance: number;
  vesu_deposited: number;
  x402_spent_total: number;
  pnl_usd: number;
  pnl_pct: number;
}) {
  const result = await query(
    `INSERT INTO snapshots (total_value_usd, usdc_balance, eth_balance, strk_balance,
                            vesu_deposited, x402_spent_total, pnl_usd, pnl_pct)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      snapshot.total_value_usd,
      snapshot.usdc_balance,
      snapshot.eth_balance,
      snapshot.strk_balance,
      snapshot.vesu_deposited,
      snapshot.x402_spent_total,
      snapshot.pnl_usd,
      snapshot.pnl_pct,
    ],
  );
  return result.rows[0] as Snapshot;
}

export async function getSnapshots(limit = 100): Promise<Snapshot[]> {
  const result = await query(
    `SELECT * FROM snapshots ORDER BY created_at ASC LIMIT $1`,
    [limit],
  );
  return result.rows as Snapshot[];
}

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  const result = await query(
    `SELECT * FROM snapshots ORDER BY created_at DESC LIMIT 1`,
  );
  return (result.rows[0] as Snapshot) ?? null;
}

// Stats
export async function getTradeStats() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE action = 'swap') as total_trades,
      COUNT(*) FILTER (WHERE action = 'swap' AND outcome = 'profit') as winning_trades,
      COUNT(*) FILTER (WHERE action = 'swap' AND outcome = 'loss') as losing_trades,
      COUNT(*) as total_decisions,
      COALESCE(SUM(x402_cost), 0) as total_x402_spent
    FROM decisions
  `);
  const row = result.rows[0];
  return {
    totalTrades: Number(row.total_trades),
    winningTrades: Number(row.winning_trades),
    losingTrades: Number(row.losing_trades),
    totalDecisions: Number(row.total_decisions),
    totalX402Spent: Number(row.total_x402_spent),
    winRate: Number(row.total_trades) > 0
      ? (Number(row.winning_trades) / Number(row.total_trades)) * 100
      : 0,
  };
}
