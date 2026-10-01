# Module 8. A model as a decision maker

A language model reads text and writes text. To make it decide, you give it the situation as text and ask for an answer in a fixed shape you can parse.

## The idea

- **Prompt = context + task + output format.** "Here is the portfolio, the market and the risk level. Answer with JSON: `{ action, from, to, amount, reason }`."
- **Structured output.** A fixed shape turns prose into data your code can check. The model can still answer something malformed, or something valid but bad: module 9 deals with both.
- **Chipi's AI API** does the prompt work for DeFi:
  - `sdk.ai.prices`: token prices.
  - `sdk.ai.signals`: technical signals, sentiment and DeFi yields.
  - `sdk.ai.think`: takes your portfolio and risk settings, adds live signals and yields to its own system prompt, calls a model, and returns a decision plus what it cost.
- **Free practice.** With a development key (`pk_dev_...`), `think` returns a sample `hold` decision for free, so you can wire everything before spending.

```
portfolio (USD) + risk score ──▶ sdk.ai.think ──▶ { decision: { action, from, to, amount, reason }, cost }
                                  (+ live signals and yields)
```

## The code

`lib/brain.ts`, `think(portfolio, strategy, maxTradeUsd)`: sends the portfolio in USD (rounded to cents), the strategy's risk score (`lib/strategies.ts`) and the largest trade as a percent of the total. It returns Chipi's answer untouched: deciding is not this file's job.

## Exercise

Ask for one decision yourself (Node, `.env.local` loaded) and read the `reason`:

```ts
const { decision, cost } = await sdk.ai.think({
  portfolio: { amountUnit: "USD", USDC: 10, ETH: 0, STRK: 0, total: 10 },
  riskScore: 5,
});
console.log(decision, cost);
```

Change `riskScore` to 1 and to 9 and compare.

## Test

```bash
npx vitest run lib/__tests__/agent.test.ts -t "records a hold"
```
