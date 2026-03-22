# Vela — Product Pager

## What is Vela?

An AI agent that manages your crypto portfolio on Starknet. It earns yield, trades, and protects your money. 24/7. Self-custodial. Gasless.

---

## Tagline

**Your money works while you sleep.**

Sub: AI agent that earns yield, catches dips, and protects your portfolio. 24/7. Start free.

---

## Tiers

### Sailor — Free
**"Your money earns interest."**
- Automatic yield on USDC
- Always picks the best rate
- Zero effort

Who: Anyone with idle USDC. Non-technical. Just wants better than 0%.
Min portfolio: $5.

### Navigator — $1/mo
**"A robot that trades for you."**
- Buys dips, sells rallies
- Reacts in seconds
- Up to 5 trades/day

Who: Wants exposure to ETH, STRK, wBTC but doesn't want to watch charts.
Min portfolio: $75.
How it works: Rules engine. No AI. Trades based on price patterns.

### Captain — $3/mo (Most Popular)
**"AI that thinks before trading."**
- Reads news and sentiment
- Protects you when things drop
- Ask: "How am I doing?"

Who: Wants the robot + a brain. Cares about protection.
Min portfolio: $75.
How it works: Same rules engine + AI judgment layer. AI reads news, reviews past performance, prevents bad trades. Stop-loss and take-profit included.

### Pirate — $5/mo
**"You set the rules."**
- Custom strategy
- Compete on the leaderboard
- Unlimited AI advice

Who: Power users who want control. Enjoy the game.
Min portfolio: $75.
How it works: Same as Captain but every parameter is configurable (risk %, tokens, sensitivity). Strategy appears on public leaderboard.

---

## The Treasure

**Every month. One winner. Real money.**

A share of subscription revenue goes into a monthly prize pool. One random ticket wins it all. USDC straight to your wallet.

**Every tier competes. Free users included.**

### How to earn tickets:
- **Invite a friend** who subscribes → 1 ticket
- **Top 10 on the leaderboard** → 1-3 tickets weekly

### Example month:
- 100 paid users x ~$3 avg = $300 revenue
- 10% to Treasure = $30 prize pool
- 200 tickets in circulation → 1 random winner

The Treasure grows with the community. More users = bigger prize = more sharing.

---

## Referral Program

Simple. No tracking forever. No rev share math.

1. You share your link: `vela.app/r/yourname`
2. Friend signs up for any paid tier
3. You get 1 Treasure ticket instantly
4. Friend gets nothing extra (the product is the reward)

Tickets accumulate. Monthly draw. That's it.

---

## How It Works (User Flow)

### Onboarding — 4 steps, 1 minute

1. **Create wallet** — Fingerprint/passkey. No seed phrases. 10 seconds.
2. **Add USDC** — Send to your wallet address. $5 minimum.
3. **Pick a plan** — Sailor (free), Navigator ($1), Captain ($3), Pirate ($5).
4. **Watch it work** — Live dashboard. Every decision explained.

### Daily Experience

User opens app → sees dashboard:
- Portfolio value + change
- Agent activity feed (what it did and why)
- Performance chart
- Treasure: your tickets, prize pool, days until draw

User does nothing. Agent works. User checks occasionally.

### Captain/Pirate: Manual AI Consultation

Tap "Ask AI" → AI reviews your portfolio, win rates, market conditions → returns plain english advice: "Your ETH trades are working. Your STRK trades are losing. Consider reducing STRK." User can adjust strategy based on this.

---

## Architecture — Two Layers

### Layer 1: Rules Engine (free, runs constantly)
- Watches prices every 1-5 seconds via Chipi price-engine
- Computes patterns (price momentum, volume, rate changes)
- Fires triggers when thresholds are crossed
- Executes yield moves (Sailor) and rule-based trades (Navigator)
- Cost: $0

### Layer 2: AI Judgment (Captain/Pirate only)
- Called only when a trigger fires
- Reads: news, sentiment, portfolio context, past decisions
- Decides: trade, skip, or adjust
- Explains every decision in plain language
- Cost: $0.003 per call (Chipi AI API)

### Why not AI for everything?
Navigator doesn't need AI. A rule that says "buy when price drops 5%" is deterministic. AI adds value when the decision requires judgment: "price dropped 5% but volume is dying and your last 3 similar trades lost money — skip."

---

## Tokens Supported

- USDC (base currency, yield)
- ETH (trading)
- STRK (trading, liquid staking)
- wBTC (trading)

---

## Protocols

- **AVNU** — DEX aggregator for swaps
- **Vesu** — USDC lending (yield)
- **Nostra** — USDC lending (yield)
- **Endur** — STRK liquid staking (Captain+)

---

## Costs & Margins

### What Vela pays to Chipi (per user/month)

| Tier | AI calls/day | Signals/day | Chipi cost/month | Revenue | Margin |
|------|-------------|-------------|-----------------|---------|--------|
| Sailor | 0 | 0 | $0 | $0 | $0 |
| Navigator | 0 (rules only) | 10 | ~$0.15 | $1 | $0.85 (85%) |
| Captain | 15 | 20 | ~$1.65 | $3 | $1.35 (45%) |
| Pirate | 20 | 30 | ~$2.85 | $5 | $2.15 (43%) |

### Chipi API pricing (what Vela pays)
- Prices: FREE
- Signals: $0.0005/call
- AI decision: $0.003/call
- Execute (build tx): $0.002/call

### Swap costs (user bears these, not Vela)
- DEX fee: ~0.3-0.5%
- Slippage: ~0.5%
- Round-trip: ~0.7%
- Gas: $0 (Chipi paymaster)

---

## Revenue Projections

| Users | Avg revenue/user | Monthly revenue | Monthly Chipi cost | Monthly margin |
|-------|-----------------|----------------|-------------------|---------------|
| 50 | $2.50 | $125 | $65 | $60 |
| 200 | $2.50 | $500 | $260 | $240 |
| 1,000 | $2.50 | $2,500 | $1,300 | $1,200 |

Treasure fund (10% of revenue): $12.50 / $50 / $250 respectively.

---

## Why AI — The Pitch

**Bots follow rules blindly. AI thinks before acting.**

| Situation | Bot | AI |
|-----------|-----|-----|
| You own too much ETH already | Buys more | "Too concentrated. Skipping." |
| Last 5 trades on STRK lost money | Buys again | "Strategy is failing. Stopping." |
| Big news: $100M grant for Starknet | Doesn't know | "Bullish. Buying STRK." |
| Signal says buy but volume is dying | Buys | "Weak setup. Waiting." |

Captain and Pirate users can also ask the AI anytime: "How is my strategy doing?" — like a financial advisor on demand.

---

## Key Differentiators

- **Self-custodial** — Your wallet, your keys. Vela has spending limits, not access.
- **Gasless** — Every transaction is gas-free via Chipi paymaster.
- **Real-time** — Prices every 1-5 seconds. Not checking every 30 minutes.
- **Transparent** — Every decision shows what happened and why.
- **Starts free** — Sailor costs nothing. Upgrade when ready.

---

## Tech Stack

- **Frontend**: Next.js 16, Tailwind v4, Framer Motion
- **Wallet**: Chipi passkeys (no seed phrases)
- **Execution**: Chipi session keys + paymaster (gasless, self-custodial)
- **AI**: Claude Haiku 4.5 via Chipi AI API
- **Data**: Chipi price-engine (Redis, 1-5s updates)
- **Chain**: Starknet mainnet (exclusive — depends on session keys + paymaster)
- **Deploy**: Vercel

---

## What Vela is NOT

- Not a wallet (it uses your Chipi wallet)
- Not an exchange (it routes through AVNU)
- Not custodial (your keys, spending caps on-chain)
- Not a trading course (it does the work for you)
- Not multi-chain yet (Starknet only — depends on Chipi infra per chain)
