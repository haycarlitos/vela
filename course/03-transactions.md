# Module 3. Transactions

A transaction is a signed list of calls: "call `transfer` on the USDC contract with these arguments, then call…". The network runs them all or none.

## The idea

- **Calls.** Each call is `{ contractAddress, entrypoint, calldata }`. Amounts go in as integers, and a 256-bit number takes two slots (`low`, `high`).
- **Signing.** Your wallet contract checks the signature before running anything. No valid signature, nothing happens.
- **A hash is not a result.** Sending returns a transaction hash right away, before the network has run it. The transaction can still revert. Always wait for the **receipt** and read its status.
- **Events.** The receipt also lists events, like `Transfer(from, to, amount)`. They are the proof of what actually moved.
- **Gasless.** Every transaction costs a fee (gas). Chipi's paymaster pays it for you, so a wallet with only USDC works.

```
build calls ──▶ sign ──▶ send ──▶ hash ──▶ wait ──▶ receipt { success | reverted, events[] }
                                          (seconds)
```

## The code

- `lib/agent.ts`: after every execution, `waitForTransaction(txHash)` and only then log the decision, with `success` from the receipt. A revert is recorded as a failure, never as a trade. If no receipt arrives in time, the hash is still recorded so the trade is never invisible.
- `lib/vesu.ts`: `splitU256` shows how an amount becomes two felts.

## Exercise

Open your wallet on Voyager and click its first transaction (the deploy). Find the status, the events, and who paid the fee: not you. After module 6, do the same with the hire transaction.

## Test

```bash
npx vitest run lib/__tests__/agent.test.ts -t "revert|receipt"
```
