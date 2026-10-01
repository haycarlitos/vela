# Module 10. From decision to transaction

`decide()` returned `{ kind: "swap", from: "USDC", to: "ETH", amountUsd: 5 }`. Now it has to become calls, be signed with the session key, and be checked on-chain.

## The idea

```
action ──▶ calls ──▶ executeTransactionWithSession ──▶ txHash ──▶ waitForTransaction ──▶ log
            │
            ├─ swap:     sdk.ai.execute builds them (approve + AVNU multi_route_swap)
            ├─ supply:   approve USDC to the vault + deposit (lib/vesu.ts)
            └─ withdraw: withdraw from the vault (lib/vesu.ts)
```

- **Who builds the calls.** For swaps, Chipi's `/v1/ai/execute` finds a route on AVNU (a DEX aggregator) and returns ready-to-sign calls. For Vesu, `lib/vesu.ts` builds them.
- **Who signs.** `executeTransactionWithSession` decrypts the session key on the server and signs. The owner key is never involved, and no prompt appears.
- **What is checked.** The session's whitelist and caps, inside the wallet contract. Then the receipt: success or revert.

## The code

`runTick` in `lib/agent.ts`, steps 3 and 4, and `callsFor` at the bottom of the file.

## Exercise

`runTick` trusts the receipt's `success`. Module 5 said that on SHHH a capped call can succeed without moving funds. Add the missing check: after a successful swap, look for a `Transfer` event from the wallet in `receipt.events` and record the trade as failed if there is none. Write the test first in `lib/__tests__/agent.test.ts` (the mocks already return `events: []`).

## Test

```bash
npx vitest run lib/__tests__/agent.test.ts -t "swap|session key"
```
