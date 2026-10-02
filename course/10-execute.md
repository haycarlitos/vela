# Module 10. From decision to transaction

`decide()` returned `{ kind: "swap", from: "USDC", to: "ETH", amountUsd: 5 }`. Now it has to become calls, be signed with the session key, and be checked on-chain.

## The idea

```
action ──▶ calls ──▶ executeTransactionWithSession ──▶ txHash ──▶ waitForTransaction ──▶ log
            │
            ├─ swap:     sdk.ai.execute builds them (approve + AVNU multi_route_swap)
            ├─ supply:   approve USDC to the router + deposit_to_self (lib/vesu.ts)
            └─ withdraw: approve vault shares to the router + withdraw_to_self (lib/vesu.ts)
```

- **Who builds the calls.** For swaps, Chipi's `/v1/ai/execute` finds a route on AVNU (a DEX aggregator) and returns ready-to-sign calls. For Vesu, `lib/vesu.ts` builds them, through the vault router (module 13).
- **Who signs.** `executeTransactionWithSession` decrypts the session key on the server and signs. The owner key is never involved, and no prompt appears.
- **What is checked.** The session's whitelist and caps, inside the wallet contract. Then the receipt, where `success` is not enough: on SHHH a call the wallet refuses (over a cap, not whitelisted, revoked session) still comes back SUCCEEDED. The paymaster's transaction ran; your wallet's call did not. So `movedFunds` also looks for a `Transfer` into or out of the wallet, and without one the trade is recorded as failed.

## The code

`runTick` in `lib/agent.ts`, steps 3 and 4, then `callsFor` and `movedFunds` at the bottom of the file.

## Exercise

1. Open [`0x3a207d39…`](https://voyager.online/tx/0x3a207d395aacc713d34bc54a9d1b9be9ae7ad17d0bd22735481148c0efb9831) on Voyager: a session key asked for an `approve` of 0.3 USDC with a 0.2 cap. Status: succeeded. Now look at the events: is there an `Approval`? Who paid the fee?
2. In `runTick`, replace `movedFunds(...)` with `true` and run the tests. Which one fails, and what would the dashboard have shown your user?

## Test

```bash
npx vitest run lib/__tests__/agent.test.ts -t "swap|session key|moved|router"
```
