// ---------------------------------------------------------------------------
// Tier-specific demo data for hardcoded dashboard experience
// ---------------------------------------------------------------------------

export type Tier = "sailor" | "navigator" | "captain" | "pirate";

export const TIER_LABELS: Record<Tier, string> = {
  sailor: "Sailor",
  navigator: "Navigator",
  captain: "Captain",
  pirate: "Pirate",
};

export const TIER_COLORS: Record<Tier, string> = {
  sailor: "var(--vela-blue)",
  navigator: "var(--vela-green)",
  captain: "#44E1B4",
  pirate: "var(--vela-gold)",
};

export const TIER_FEATURES: Record<Tier, {
  trades: boolean;
  aiJudgment: boolean;
  askAI: boolean;
  leaderboardCompete: boolean;
  customStrategy: boolean;
  stopLossTakeProfit: boolean;
}> = {
  sailor: { trades: false, aiJudgment: false, askAI: false, leaderboardCompete: false, customStrategy: false, stopLossTakeProfit: false },
  navigator: { trades: true, aiJudgment: false, askAI: false, leaderboardCompete: false, customStrategy: false, stopLossTakeProfit: false },
  captain: { trades: true, aiJudgment: true, askAI: true, leaderboardCompete: false, customStrategy: false, stopLossTakeProfit: true },
  pirate: { trades: true, aiJudgment: true, askAI: true, leaderboardCompete: true, customStrategy: true, stopLossTakeProfit: true },
};

// ---------------------------------------------------------------------------
// Tabs per tier
// ---------------------------------------------------------------------------

export type TabId = "overview" | "leaderboard" | "treasure" | "strategy" | "settings";

export const TIER_TABS: Record<Tier, { id: TabId; label: string }[]> = {
  sailor: [
    { id: "overview", label: "Overview" },
    { id: "treasure", label: "Treasure" },
    { id: "settings", label: "Settings" },
  ],
  navigator: [
    { id: "overview", label: "Overview" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "treasure", label: "Treasure" },
    { id: "settings", label: "Settings" },
  ],
  captain: [
    { id: "overview", label: "Overview" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "treasure", label: "Treasure" },
    { id: "settings", label: "Settings" },
  ],
  pirate: [
    { id: "overview", label: "Overview" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "treasure", label: "Treasure" },
    { id: "strategy", label: "Strategy" },
    { id: "settings", label: "Settings" },
  ],
};

// ---------------------------------------------------------------------------
// Status data interface (shared with dashboard)
// ---------------------------------------------------------------------------

export interface StatusData {
  portfolio: {
    totalValueUsd: number;
    usdc: { balance: number; usd: number };
    eth: { balance: number; usd: number; price: number };
    strk: { balance: number; usd: number; price: number };
    vesuDeposited: number;
    vesuApy: number;
  };
  decisions: {
    id: number;
    createdAt: string;
    action: string;
    pair: string | null;
    amountUsd: number | null;
    reasoning: string | null;
    txHash: string | null;
    outcome: string;
  }[];
  snapshots: {
    createdAt: string;
    totalValueUsd: number;
    pnlUsd: number;
    pnlPct: number;
  }[];
  stats: {
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalDecisions: number;
    totalX402Spent: number;
  };
  pnl: { usd: number; pct: number };
}

// ---------------------------------------------------------------------------
// Treasure data
// ---------------------------------------------------------------------------

export interface TreasureData {
  prizePool: number;
  daysUntilDraw: number;
  tickets: number;
  breakdown: { source: string; count: number }[];
}

export const TREASURE_BY_TIER: Record<Tier, TreasureData> = {
  sailor: {
    prizePool: 42.50,
    daysUntilDraw: 12,
    tickets: 1,
    breakdown: [{ source: "Referrals", count: 1 }],
  },
  navigator: {
    prizePool: 42.50,
    daysUntilDraw: 12,
    tickets: 2,
    breakdown: [{ source: "Referrals", count: 2 }],
  },
  captain: {
    prizePool: 42.50,
    daysUntilDraw: 12,
    tickets: 4,
    breakdown: [
      { source: "Referrals", count: 2 },
      { source: "Leaderboard (4th place)", count: 2 },
    ],
  },
  pirate: {
    prizePool: 42.50,
    daysUntilDraw: 12,
    tickets: 9,
    breakdown: [
      { source: "Referrals (2x Pirate bonus)", count: 4 },
      { source: "Leaderboard (1st place)", count: 5 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Leaderboard data
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  username: string;
  strategy: string;
  monthlyReturn: number;
  tier: Tier;
  isCurrentUser: boolean;
  weeklyTickets: number; // 0 if not in top 5
}

export function getLeaderboardData(currentTier: Tier): LeaderboardEntry[] {
  const currentUsername = "you";
  const currentStrategy = currentTier === "pirate" ? "Momentum Alpha" : "Balanced Growth";
  const currentReturn = currentTier === "pirate" ? 12.4 : currentTier === "captain" ? 2.1 : currentTier === "navigator" ? 3.0 : 0.5;

  const others: Omit<LeaderboardEntry, "rank" | "weeklyTickets" | "isCurrentUser">[] = [
    { username: "wave_rider", strategy: "Momentum Surfer", monthlyReturn: 12.4, tier: "pirate" as Tier },
    { username: "steady_sailor", strategy: "Yield Optimizer", monthlyReturn: 8.7, tier: "captain" as Tier },
    { username: "dip_hunter", strategy: "Dip Catcher Pro", monthlyReturn: 7.2, tier: "pirate" as Tier },
    { username: "calm_waters", strategy: "Conservative Hold", monthlyReturn: 5.9, tier: "captain" as Tier },
    { username: "reef_runner", strategy: "Quick Flip", monthlyReturn: 4.8, tier: "navigator" as Tier },
    { username: "tide_watcher", strategy: "Sentiment Reader", monthlyReturn: 3.5, tier: "captain" as Tier },
    { username: "anchor_hold", strategy: "Pure Yield", monthlyReturn: 1.8, tier: "sailor" as Tier },
  ];

  // Insert current user based on their return
  const allEntries = [
    ...others,
    { username: currentUsername, strategy: currentStrategy, monthlyReturn: currentReturn, tier: currentTier },
  ];

  // Sort by return descending
  allEntries.sort((a, b) => b.monthlyReturn - a.monthlyReturn);

  // If pirate ties with wave_rider, keep pirate first
  return allEntries.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    isCurrentUser: entry.username === currentUsername,
    weeklyTickets: i < 5 ? 5 - i : 0, // 1st: 5, 2nd: 4, 3rd: 3, 4th: 2, 5th: 1
  }));
}

// ---------------------------------------------------------------------------
// Ask AI conversations per tier
// ---------------------------------------------------------------------------

export interface AIChatMessage {
  role: "user" | "ai";
  message: string;
}

export const ASK_AI_CONVERSATIONS: Record<Tier, AIChatMessage[]> = {
  sailor: [], // no AI access
  navigator: [], // no AI access
  captain: [
    { role: "user", message: "How am I doing?" },
    {
      role: "ai",
      message:
        "Your ETH trades are working well — 4 out of 5 profitable. Your STRK position has been losing. Consider reducing STRK exposure. Overall, your strategy is +2.1% this month.",
    },
  ],
  pirate: [
    { role: "user", message: "Should I change my strategy?" },
    {
      role: "ai",
      message:
        "Your Momentum Alpha strategy is ranked #1 this week with +12.4% returns. ETH momentum trades are your strongest — 6 of 8 profitable. STRK trades are mixed. Consider tightening your RSI threshold from 30 to 25 to filter weaker setups. Your risk allocation looks good at 60%.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helper: generate relative timestamps
// ---------------------------------------------------------------------------

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

function txHash(seed: number): string {
  const hex = seed.toString(16).padStart(8, "0");
  return `0x0${hex}a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6`;
}

// ---------------------------------------------------------------------------
// Demo datasets per tier
// ---------------------------------------------------------------------------

const SAILOR_DATA: StatusData = {
  portfolio: {
    totalValueUsd: 25.13,
    usdc: { balance: 0.12, usd: 0.12 },
    eth: { balance: 0, usd: 0, price: 2469.88 },
    strk: { balance: 0, usd: 0, price: 0.399 },
    vesuDeposited: 25.01,
    vesuApy: 6.2,
  },
  decisions: [
    { id: 1, createdAt: ago(30), action: "hold", pair: null, amountUsd: null, reasoning: "Your USDC is earning 6.2% APY on Vesu. No action needed.", txHash: null, outcome: "open" },
    { id: 2, createdAt: ago(90), action: "supply_vesu", pair: null, amountUsd: 10.0, reasoning: "Moved your idle USDC into Vesu. Now earning 6.2% annual yield.", txHash: txHash(1), outcome: "open" },
    { id: 3, createdAt: ago(150), action: "hold", pair: null, amountUsd: null, reasoning: "Vesu rate is still the best available. Staying put.", txHash: null, outcome: "open" },
    { id: 4, createdAt: ago(210), action: "supply_vesu", pair: null, amountUsd: 15.0, reasoning: "Depositing remaining USDC into Vesu for yield.", txHash: txHash(2), outcome: "open" },
    { id: 5, createdAt: ago(270), action: "hold", pair: null, amountUsd: null, reasoning: "Scanning rates across Vesu and Nostra. Vesu is still winning.", txHash: null, outcome: "open" },
    { id: 6, createdAt: ago(330), action: "hold", pair: null, amountUsd: null, reasoning: "Just started. Checking the best yield options for your USDC.", txHash: null, outcome: "open" },
  ],
  snapshots: [
    { createdAt: ago(330), totalValueUsd: 25.0, pnlUsd: 0, pnlPct: 0 },
    { createdAt: ago(270), totalValueUsd: 25.0, pnlUsd: 0, pnlPct: 0 },
    { createdAt: ago(210), totalValueUsd: 25.02, pnlUsd: 0.02, pnlPct: 0.08 },
    { createdAt: ago(150), totalValueUsd: 25.05, pnlUsd: 0.05, pnlPct: 0.2 },
    { createdAt: ago(90), totalValueUsd: 25.08, pnlUsd: 0.08, pnlPct: 0.32 },
    { createdAt: ago(30), totalValueUsd: 25.13, pnlUsd: 0.13, pnlPct: 0.52 },
  ],
  stats: { winRate: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0, totalDecisions: 6, totalX402Spent: 0 },
  pnl: { usd: 0.13, pct: 0.52 },
};

const NAVIGATOR_DATA: StatusData = {
  portfolio: {
    totalValueUsd: 154.50,
    usdc: { balance: 30.0, usd: 30.0 },
    eth: { balance: 0.0162, usd: 40.0, price: 2469.88 },
    strk: { balance: 75.19, usd: 30.0, price: 0.399 },
    vesuDeposited: 54.50,
    vesuApy: 6.2,
  },
  decisions: [
    { id: 1, createdAt: ago(20), action: "hold", pair: null, amountUsd: null, reasoning: "Markets are calm. Holding positions.", txHash: null, outcome: "open" },
    { id: 2, createdAt: ago(60), action: "swap", pair: "USDC→ETH", amountUsd: 15.0, reasoning: "ETH dropped 5.1% in 2 hours. Price target hit. Buying.", txHash: txHash(10), outcome: "profit" },
    { id: 3, createdAt: ago(120), action: "hold", pair: null, amountUsd: null, reasoning: "No price targets triggered. Watching.", txHash: null, outcome: "open" },
    { id: 4, createdAt: ago(180), action: "swap", pair: "ETH→USDC", amountUsd: 12.0, reasoning: "ETH up 4.3% from entry. Take-profit triggered.", txHash: txHash(11), outcome: "profit" },
    { id: 5, createdAt: ago(240), action: "supply_vesu", pair: null, amountUsd: 20.0, reasoning: "Moving idle USDC into Vesu yield.", txHash: txHash(12), outcome: "open" },
    { id: 6, createdAt: ago(300), action: "swap", pair: "USDC→STRK", amountUsd: 10.0, reasoning: "STRK dropped 6.2%. Buying the dip.", txHash: txHash(13), outcome: "profit" },
    { id: 7, createdAt: ago(360), action: "hold", pair: null, amountUsd: null, reasoning: "Waiting for next price trigger.", txHash: null, outcome: "open" },
    { id: 8, createdAt: ago(420), action: "swap", pair: "STRK→USDC", amountUsd: 8.0, reasoning: "STRK up 3.8%. Selling at target.", txHash: txHash(14), outcome: "profit" },
    { id: 9, createdAt: ago(480), action: "swap", pair: "USDC→ETH", amountUsd: 5.0, reasoning: "ETH dropped 4.5%. Small buy.", txHash: txHash(15), outcome: "loss" },
    { id: 10, createdAt: ago(540), action: "hold", pair: null, amountUsd: null, reasoning: "All positions within targets. No action.", txHash: null, outcome: "open" },
    { id: 11, createdAt: ago(600), action: "supply_vesu", pair: null, amountUsd: 30.0, reasoning: "Initial USDC deposit into Vesu for yield.", txHash: txHash(16), outcome: "open" },
    { id: 12, createdAt: ago(660), action: "hold", pair: null, amountUsd: null, reasoning: "Starting up. Scanning prices and setting targets.", txHash: null, outcome: "open" },
  ],
  snapshots: [
    { createdAt: ago(660), totalValueUsd: 150.0, pnlUsd: 0, pnlPct: 0 },
    { createdAt: ago(600), totalValueUsd: 150.0, pnlUsd: 0, pnlPct: 0 },
    { createdAt: ago(540), totalValueUsd: 149.50, pnlUsd: -0.50, pnlPct: -0.33 },
    { createdAt: ago(480), totalValueUsd: 149.80, pnlUsd: -0.20, pnlPct: -0.13 },
    { createdAt: ago(420), totalValueUsd: 150.90, pnlUsd: 0.90, pnlPct: 0.6 },
    { createdAt: ago(360), totalValueUsd: 150.50, pnlUsd: 0.50, pnlPct: 0.33 },
    { createdAt: ago(300), totalValueUsd: 151.20, pnlUsd: 1.20, pnlPct: 0.8 },
    { createdAt: ago(240), totalValueUsd: 151.80, pnlUsd: 1.80, pnlPct: 1.2 },
    { createdAt: ago(180), totalValueUsd: 152.50, pnlUsd: 2.50, pnlPct: 1.67 },
    { createdAt: ago(120), totalValueUsd: 153.00, pnlUsd: 3.00, pnlPct: 2.0 },
    { createdAt: ago(60), totalValueUsd: 153.80, pnlUsd: 3.80, pnlPct: 2.53 },
    { createdAt: ago(20), totalValueUsd: 154.50, pnlUsd: 4.50, pnlPct: 3.0 },
  ],
  stats: { winRate: 80, totalTrades: 5, winningTrades: 4, losingTrades: 1, totalDecisions: 12, totalX402Spent: 0 },
  pnl: { usd: 4.50, pct: 3.0 },
};

const CAPTAIN_DATA: StatusData = {
  portfolio: {
    totalValueUsd: 255.25,
    usdc: { balance: 40.0, usd: 40.0 },
    eth: { balance: 0.0304, usd: 75.0, price: 2469.88 },
    strk: { balance: 87.72, usd: 35.0, price: 0.399 },
    vesuDeposited: 105.25,
    vesuApy: 6.2,
  },
  decisions: [
    { id: 1, createdAt: ago(30), action: "hold", pair: null, amountUsd: null, reasoning: "Market is quiet. Protecting your balance until a better opportunity shows up.", txHash: null, outcome: "open" },
    { id: 2, createdAt: ago(60), action: "swap", pair: "USDC→ETH", amountUsd: 20.0, reasoning: "ETH dropped 6.2% in 2 hours. News sentiment is neutral — no red flags. Buying the dip.", txHash: txHash(20), outcome: "profit" },
    { id: 3, createdAt: ago(90), action: "hold", pair: null, amountUsd: null, reasoning: "Signal fired on STRK but volume is dying. Weak setup. Waiting for confirmation.", txHash: null, outcome: "open" },
    { id: 4, createdAt: ago(120), action: "supply_vesu", pair: null, amountUsd: 40.0, reasoning: "Your idle USDC is now earning 6.2% annual yield. Money working for you.", txHash: txHash(21), outcome: "open" },
    { id: 5, createdAt: ago(150), action: "swap", pair: "USDC→STRK", amountUsd: 15.0, reasoning: "Starknet just announced a $100M ecosystem grant. Bullish signal. Buying STRK.", txHash: txHash(22), outcome: "loss" },
    { id: 6, createdAt: ago(180), action: "hold", pair: null, amountUsd: null, reasoning: "Just reviewed your portfolio. You're 30% ETH which is within limits. No rebalancing needed.", txHash: null, outcome: "open" },
    { id: 7, createdAt: ago(210), action: "swap", pair: "ETH→USDC", amountUsd: 18.0, reasoning: "ETH up 4.1% since we bought. Locking in profits before potential pullback.", txHash: txHash(23), outcome: "profit" },
    { id: 8, createdAt: ago(240), action: "hold", pair: null, amountUsd: null, reasoning: "Weekend market. Liquidity is low. Sitting this one out.", txHash: null, outcome: "open" },
    { id: 9, createdAt: ago(270), action: "supply_vesu", pair: null, amountUsd: 25.0, reasoning: "Adding more to yield. Total deposit now earning passively.", txHash: txHash(24), outcome: "open" },
    { id: 10, createdAt: ago(300), action: "swap", pair: "USDC→ETH", amountUsd: 10.0, reasoning: "ETH at a weekly low. Small position to catch the rebound.", txHash: txHash(25), outcome: "profit" },
    { id: 11, createdAt: ago(330), action: "hold", pair: null, amountUsd: null, reasoning: "Your last 2 STRK trades lost money. AI is pausing STRK until pattern improves.", txHash: null, outcome: "open" },
    { id: 12, createdAt: ago(360), action: "withdraw_vesu", pair: null, amountUsd: 15.0, reasoning: "Freeing up capital for a trade opportunity spotted ahead.", txHash: txHash(26), outcome: "open" },
    { id: 13, createdAt: ago(390), action: "swap", pair: "STRK→USDC", amountUsd: 12.0, reasoning: "STRK up 8% since entry. Taking profit on this position.", txHash: txHash(27), outcome: "profit" },
    { id: 14, createdAt: ago(420), action: "swap", pair: "USDC→ETH", amountUsd: 8.0, reasoning: "ETH sentiment turned positive. Multiple on-chain indicators bullish.", txHash: txHash(28), outcome: "profit" },
    { id: 15, createdAt: ago(450), action: "hold", pair: null, amountUsd: null, reasoning: "Starting up. Scanning the market and learning the landscape.", txHash: null, outcome: "open" },
  ],
  snapshots: [
    { createdAt: ago(450), totalValueUsd: 250.0, pnlUsd: 0, pnlPct: 0 },
    { createdAt: ago(420), totalValueUsd: 250.0, pnlUsd: 0, pnlPct: 0 },
    { createdAt: ago(390), totalValueUsd: 249.50, pnlUsd: -0.50, pnlPct: -0.2 },
    { createdAt: ago(360), totalValueUsd: 250.20, pnlUsd: 0.20, pnlPct: 0.08 },
    { createdAt: ago(330), totalValueUsd: 250.20, pnlUsd: 0.20, pnlPct: 0.08 },
    { createdAt: ago(300), totalValueUsd: 249.80, pnlUsd: -0.20, pnlPct: -0.08 },
    { createdAt: ago(270), totalValueUsd: 250.50, pnlUsd: 0.50, pnlPct: 0.2 },
    { createdAt: ago(240), totalValueUsd: 250.50, pnlUsd: 0.50, pnlPct: 0.2 },
    { createdAt: ago(210), totalValueUsd: 251.80, pnlUsd: 1.80, pnlPct: 0.72 },
    { createdAt: ago(180), totalValueUsd: 251.80, pnlUsd: 1.80, pnlPct: 0.72 },
    { createdAt: ago(150), totalValueUsd: 251.20, pnlUsd: 1.20, pnlPct: 0.48 },
    { createdAt: ago(120), totalValueUsd: 252.50, pnlUsd: 2.50, pnlPct: 1.0 },
    { createdAt: ago(90), totalValueUsd: 252.50, pnlUsd: 2.50, pnlPct: 1.0 },
    { createdAt: ago(60), totalValueUsd: 254.00, pnlUsd: 4.00, pnlPct: 1.6 },
    { createdAt: ago(30), totalValueUsd: 255.25, pnlUsd: 5.25, pnlPct: 2.1 },
  ],
  stats: { winRate: 71, totalTrades: 7, winningTrades: 5, losingTrades: 2, totalDecisions: 15, totalX402Spent: 0.015 },
  pnl: { usd: 5.25, pct: 2.1 },
};

const PIRATE_DATA: StatusData = {
  portfolio: {
    totalValueUsd: 524.0,
    usdc: { balance: 50.0, usd: 50.0 },
    eth: { balance: 0.0729, usd: 180.0, price: 2469.88 },
    strk: { balance: 250.63, usd: 100.0, price: 0.399 },
    vesuDeposited: 194.0,
    vesuApy: 6.2,
  },
  decisions: [
    { id: 1, createdAt: ago(15), action: "swap", pair: "USDC→ETH", amountUsd: 30.0, reasoning: "Custom rule: RSI below 30 on 1h chart. Triggered. Aggressive buy.", txHash: txHash(30), outcome: "profit" },
    { id: 2, createdAt: ago(45), action: "hold", pair: null, amountUsd: null, reasoning: "Risk limit reached for today ($150). Holding remaining positions.", txHash: null, outcome: "open" },
    { id: 3, createdAt: ago(75), action: "swap", pair: "ETH→USDC", amountUsd: 25.0, reasoning: "Take-profit at +8% hit. Locking gains. Strategy rule: never hold past target.", txHash: txHash(31), outcome: "profit" },
    { id: 4, createdAt: ago(105), action: "swap", pair: "USDC→STRK", amountUsd: 20.0, reasoning: "STRK momentum turning positive. Volume spike detected. Entering position.", txHash: txHash(32), outcome: "profit" },
    { id: 5, createdAt: ago(135), action: "swap", pair: "STRK→USDC", amountUsd: 15.0, reasoning: "Stop-loss triggered at -5%. Cutting losses early per strategy rules.", txHash: txHash(33), outcome: "loss" },
    { id: 6, createdAt: ago(165), action: "supply_vesu", pair: null, amountUsd: 50.0, reasoning: "Allocating 30% to yield as per strategy. Reducing active risk exposure.", txHash: txHash(34), outcome: "open" },
    { id: 7, createdAt: ago(195), action: "swap", pair: "USDC→ETH", amountUsd: 40.0, reasoning: "ETH broke key resistance. Momentum confirmed on 4h chart. Going heavy.", txHash: txHash(35), outcome: "profit" },
    { id: 8, createdAt: ago(225), action: "hold", pair: null, amountUsd: null, reasoning: "Portfolio at 60% risk allocation. Strategy cap reached. Waiting for exits.", txHash: null, outcome: "open" },
    { id: 9, createdAt: ago(255), action: "swap", pair: "ETH→USDC", amountUsd: 35.0, reasoning: "ETH hit +6% target. Partial exit to de-risk. Keeping 40% of position.", txHash: txHash(36), outcome: "profit" },
    { id: 10, createdAt: ago(285), action: "swap", pair: "USDC→STRK", amountUsd: 25.0, reasoning: "Starknet ecosystem news is bullish. Overriding momentum filter.", txHash: txHash(37), outcome: "profit" },
    { id: 11, createdAt: ago(315), action: "swap", pair: "STRK→USDC", amountUsd: 18.0, reasoning: "STRK lost momentum. Volume dropping. Exiting before reversal.", txHash: txHash(38), outcome: "loss" },
    { id: 12, createdAt: ago(345), action: "hold", pair: null, amountUsd: null, reasoning: "Reviewing strategy performance. 67% win rate this week. Acceptable.", txHash: null, outcome: "open" },
    { id: 13, createdAt: ago(375), action: "swap", pair: "USDC→ETH", amountUsd: 20.0, reasoning: "ETH dipped to weekly support. High probability bounce zone.", txHash: txHash(39), outcome: "profit" },
    { id: 14, createdAt: ago(405), action: "supply_vesu", pair: null, amountUsd: 100.0, reasoning: "Rebalancing: moving profits to yield. Strategy says lock 40% gains.", txHash: txHash(40), outcome: "open" },
    { id: 15, createdAt: ago(435), action: "swap", pair: "USDC→STRK", amountUsd: 30.0, reasoning: "STRK breakout above 20-day moving average. Strong entry.", txHash: txHash(41), outcome: "profit" },
    { id: 16, createdAt: ago(465), action: "swap", pair: "ETH→USDC", amountUsd: 22.0, reasoning: "ETH hitting resistance. Scaling out per strategy.", txHash: txHash(42), outcome: "profit" },
    { id: 17, createdAt: ago(495), action: "hold", pair: null, amountUsd: null, reasoning: "Markets choppy. No clear signals. Cash is a position too.", txHash: null, outcome: "open" },
    { id: 18, createdAt: ago(525), action: "swap", pair: "USDC→ETH", amountUsd: 15.0, reasoning: "Accumulating ETH on dips. Long-term thesis intact.", txHash: txHash(43), outcome: "loss" },
    { id: 19, createdAt: ago(555), action: "swap", pair: "STRK→USDC", amountUsd: 10.0, reasoning: "Taking small STRK profit. Keeping core position.", txHash: txHash(44), outcome: "loss" },
    { id: 20, createdAt: ago(585), action: "hold", pair: null, amountUsd: null, reasoning: "Strategy initialized. Scanning markets with custom parameters.", txHash: null, outcome: "open" },
  ],
  snapshots: [
    { createdAt: ago(585), totalValueUsd: 500.0, pnlUsd: 0, pnlPct: 0 },
    { createdAt: ago(525), totalValueUsd: 498.0, pnlUsd: -2.0, pnlPct: -0.4 },
    { createdAt: ago(465), totalValueUsd: 502.0, pnlUsd: 2.0, pnlPct: 0.4 },
    { createdAt: ago(405), totalValueUsd: 505.0, pnlUsd: 5.0, pnlPct: 1.0 },
    { createdAt: ago(345), totalValueUsd: 503.0, pnlUsd: 3.0, pnlPct: 0.6 },
    { createdAt: ago(285), totalValueUsd: 508.0, pnlUsd: 8.0, pnlPct: 1.6 },
    { createdAt: ago(225), totalValueUsd: 512.0, pnlUsd: 12.0, pnlPct: 2.4 },
    { createdAt: ago(165), totalValueUsd: 510.0, pnlUsd: 10.0, pnlPct: 2.0 },
    { createdAt: ago(105), totalValueUsd: 515.0, pnlUsd: 15.0, pnlPct: 3.0 },
    { createdAt: ago(45), totalValueUsd: 520.0, pnlUsd: 20.0, pnlPct: 4.0 },
    { createdAt: ago(15), totalValueUsd: 524.0, pnlUsd: 24.0, pnlPct: 4.8 },
  ],
  stats: { winRate: 67, totalTrades: 12, winningTrades: 8, losingTrades: 4, totalDecisions: 20, totalX402Spent: 0.020 },
  pnl: { usd: 24.0, pct: 4.8 },
};

export const DEMO_DATA_BY_TIER: Record<Tier, StatusData> = {
  sailor: SAILOR_DATA,
  navigator: NAVIGATOR_DATA,
  captain: CAPTAIN_DATA,
  pirate: PIRATE_DATA,
};
