# vault-router

A ~60-line Cairo contract that lets an agent's session key use an ERC-4626 vault (Vesu) without being able to send the money anywhere else. Course module 13 builds it step by step.

**The problem.** A vault's `withdraw(assets, receiver, owner)` takes a receiver, and the wallet's spending policies do not meter it. A session key is scoped by function name, not by argument, so whitelisting `withdraw` would let a leaked key send the whole position to any address.

**The fix.** The session whitelists `deposit_to_self` and `withdraw_to_self` instead (never `deposit` or `withdraw`). They take no receiver: shares and assets always go back to the caller. Those names are selectors, valid on any contract, so the router alone is not the guarantee: the guarantee is that money only moves through capped approvals.

| Agent wants to | Session calls | Capped by |
|---|---|---|
| Deposit | `USDC.approve(router, x)` then `router.deposit_to_self(x)` | the USDC spending policy |
| Withdraw | `vault.approve(router, vault.preview_withdraw(x))` then `router.withdraw_to_self(x)` | the vault-shares spending policy, in share units (18 decimals) |

The router has no owner and holds nothing between transactions; tokens sent to it directly cannot be recovered.

## Test

```bash
scarb build
snforge test --max-threads 1
```

The tests fork Starknet mainnet at a fixed block and run against the real Vesu Re7 USDC Core vault and native USDC. Nothing is spent. They show that deposits credit the caller, withdrawals pay the caller, a withdrawal needs a share approval, and nobody can withdraw someone else's position.

## Deploy

One router per vault: the vault address is fixed at deploy time.

```bash
# An account with a little STRK for fees, imported once:
sncast account import --name deployer --address 0x... --type oz --private-key 0x...
sncast declare --contract-name VaultRouter
sncast deploy --class-hash <class hash from declare> \
  --arguments '0x017891114c00b07317b9102adefbad9fd5de40c5616f094ee09fe2fad67191b1'
```

Vela's router is `VESU_ROUTER` in `lib/config.ts`: `lib/vesu.ts` builds the calls above, `SESSION_ENTRYPOINTS` whitelists the two router functions instead of `deposit`/`withdraw`, and `spendingPolicies` caps the vault shares. If you deploy your own, put its address there.
