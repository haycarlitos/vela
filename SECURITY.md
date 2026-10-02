# Security

## Reporting

Use GitHub's private vulnerability reporting (the repository's **Security** tab, **Report a vulnerability**). Please do not open a public issue for a vulnerability.

## Model

Vela runs an agent on a user's self-custodial wallet. The layers, from strongest to weakest:

1. **The wallet contract (on-chain).** The agent signs only with a session key. The contract limits that key to a function whitelist (`lib/config.ts`, `SESSION_ENTRYPOINTS`), a call budget, an expiry, and a per-call and per-day cap for USDC, ETH and STRK, and the Vesu vault's shares (`lib/policy.ts`, `spendingPolicies`). Vela only activates an agent after reading those caps back from the chain. A bug anywhere in Vela cannot move more than those caps.
2. **The policy guard (`lib/policy.ts`).** Deterministic. The model's answer is advice: only a known action, in a tradable token, inside the user's max trade and the wallet's balances, reaches the chain.
3. **Receipts.** A transaction hash is not a result. Every execution waits for its receipt (`waitForTransaction`) and a revert is recorded as a failure.

What the server holds:

- **The session private key**, encrypted with a key derived from `CHIPI_SECRET_KEY` (or with `VELA_SESSION_SECRET` when set). Anyone with both the database and that secret can act as the agent, within the on-chain caps and until the session expires or the user revokes it.
- **Better Auth's JWT signing key**, encrypted with `BETTER_AUTH_SECRET` (derived from `CHIPI_SECRET_KEY` by default). With it, someone could sign in to Chipi as any of your users, but not move their funds: the wallet key is encrypted with each user's passkey.
- **Never the owner key.** The wallet key is encrypted with the passkey's WebAuthn PRF secret in the browser. Registering, capping and revoking the session happen in the browser with the user's passkey.

## Known limits

- **SHHH V8.4** (the wallet contract) is pending its external audit. Vela refuses to manage wallets above `MAX_DEPOSIT_USD` ($100 by default).
- **The whitelist is not scoped to a contract.** A whitelisted function (`approve`, for example) is allowed on every contract, which is why every token the wallet can hold has a spending policy. A token outside USDC, ETH, STRK and the Vesu shares sent to the wallet is not capped: do not hold other tokens in an agent wallet.
- **Spending policies meter `transfer`, `approve` and `increase_allowance`**, not `transfer_from`, and not a vault's `withdraw` or `redeem`. So the session never whitelists Vesu's `withdraw` (it takes any receiver): it calls the vault router's `deposit_to_self` and `withdraw_to_self` (`contracts/vault-router`, course module 13), which pay only the caller, after a capped `approve`. Agents hired before the router still whitelist the vault's own `deposit`/`withdraw`: stop and hire them again.
- **On SHHH, a refused session call reports success without moving funds**: over a cap, not whitelisted, or after revocation. Check the receipt's `Transfer` events, not only its status (`movedFunds` in `lib/agent.ts`).
