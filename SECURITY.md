# Security

## Reporting

Use GitHub's private vulnerability reporting (the repository's **Security** tab, **Report a vulnerability**). Please do not open a public issue for a vulnerability.

## Model

Vela runs an agent on a user's self-custodial wallet. The layers, from strongest to weakest:

1. **The wallet contract (on-chain).** The agent signs only with a session key. The contract limits that key to a function whitelist (`lib/config.ts`, `SESSION_ENTRYPOINTS`), a call budget, an expiry, and a per-call and per-day cap for USDC, ETH and STRK (`lib/policy.ts`, `spendingPolicies`). A bug anywhere in Vela cannot move more than those caps.
2. **The policy guard (`lib/policy.ts`).** Deterministic. The model's answer is advice: only a known action, in a tradable token, inside the user's max trade and the wallet's balances, reaches the chain.
3. **Receipts.** A transaction hash is not a result. Every execution waits for its receipt (`waitForTransaction`) and a revert is recorded as a failure.

What the server holds:

- **The session private key**, encrypted with `VELA_SESSION_SECRET`. Anyone with both the database and the secret can act as the agent, within the on-chain caps and until the session expires or the user revokes it.
- **Never the owner key.** The wallet key is encrypted with the passkey's WebAuthn PRF secret in the browser. Registering, capping and revoking the session happen in the browser with the user's passkey.

## Known limits (beta)

- **SHHH V8.4** (the wallet contract) is pending its external audit. The beta caps managed wallets at $100 (`BETA_DEPOSIT_CAP_USD`).
- **x402 on `/api/think` is first-come-first-served for anonymous payers.** A payment is a public on-chain transfer, and the endpoint takes the payer's address from the `X-PAYMENT` header. Someone who sees the transfer can submit its hash first and get the decision; the real payer then gets `ALREADY_USED`. At $0.001 per call this is a nuisance, not a loss of funds. Vela's own agents verify their payment in-process right after sending it.
- **The whitelist is not scoped to a contract.** `transfer` and `approve` are allowed on every token, which is why every token the wallet can hold has a spending policy. A token outside USDC, ETH and STRK sent to the wallet is not capped: do not hold other tokens in an agent wallet.
- **Spending policies meter `transfer`, `approve` and `increase_allowance`**, not `transfer_from`, and not the vault's `withdraw` (which only returns funds to the wallet).
