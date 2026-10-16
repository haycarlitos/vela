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

## Using your own model key

Vela uses Chipi's AI API on purpose: one key, live signals and yields already in the prompt, free sample decisions with a development key, and an agent that can pay for each decision itself in USDC over x402 (module 12). Vela keeps it that way. Your fork can use a key from another model provider instead:

1. **Replace the body of `think()` in `lib/brain.ts`.** Build the prompt from the portfolio, the strategy's risk score and `maxTradeUsd`, and call your provider's SDK with a key kept on the server (for example `MODEL_API_KEY` in `.env.local` and in Vercel).
2. **Ask for the same JSON** (`{ action, from, to, amount, reason }`) and return it as `{ decision, cost }`, so `lib/agent.ts` and `aiCostUsd` keep working.
3. **Bring your own market context.** Fetch prices and signals yourself, or keep `sdk.ai.signals` for that part.
4. **Leave `decide()` in `lib/policy.ts` alone.** It is what makes any model safe to plug in (module 9).
5. **Leave `VELA_PAY_AI_WITH_X402` off.** x402 is a payment between the agent and Chipi.

What changes: your provider bills your card instead of the agent paying in USDC, the key lives on your server, you lose the signals Chipi adds unless you fetch them, and development keys no longer give free sample decisions.

With an AI coding assistant, ask for it like this:

> In `lib/brain.ts`, replace the body of `think()` with a call to <provider> using the `MODEL_API_KEY` env var. Send the portfolio in USD, the strategy's risk score and the max trade, and ask for JSON `{ action, from, to, amount, reason }`. Return it in the same shape (`decision`, `cost`) so `lib/agent.ts` keeps working. Do not change `lib/policy.ts` or the session caps. Add a test like `lib/__tests__/agent.test.ts`.

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
