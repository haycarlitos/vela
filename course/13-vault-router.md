# Module 13. Yield without losing control: your first contract

Idle USDC can earn interest in a lending vault like Vesu. Letting the agent move money in and out sounds harmless. It is not, and fixing it is your first smart contract.

## The problem

Vesu's vault follows the ERC-4626 standard:

```
deposit(assets, receiver)            -> shares go to receiver
withdraw(assets, receiver, owner)    -> assets go to receiver
```

Two things make `withdraw` dangerous for a session key:

1. **Anyone can be the receiver.** The function takes any address.
2. **It is not metered.** Spending policies watch `transfer`, `approve` and `increase_allowance` (module 5). `withdraw` is none of them.

And a session whitelist holds function names, not arguments (module 4). Whitelisting `withdraw` means a leaked session key can send your whole Vesu position anywhere, in one call, under every cap. Today's Vela still whitelists it, and `SECURITY.md` says so.

## The fix: a router

A ~60-line contract with two functions that take **no receiver**:

```
deposit_to_self(assets)   pulls assets from the caller, deposits, shares go to the caller
withdraw_to_self(assets)  withdraws from the caller's position, assets go to the caller
```

The session whitelists these two names instead of `deposit` and `withdraw`. Money still moves only through capped calls: depositing needs `USDC.approve(router, x)`, withdrawing needs `vault.approve(router, shares)`, and the spending policies meter both approvals.

Think it through: the names `deposit_to_self` and `withdraw_to_self` are valid on *any* contract too. Why can an attacker's contract with the same names not steal anything? (Answer: it gets nothing without one of those capped approvals.)

## The code

`contracts/vault-router/`:

- `src/lib.cairo`: the contract. Read the header comment first, then the two functions. The vault is fixed in the constructor, so nobody can point the router at a fake vault.
- `tests/test_router.cairo`: **fork tests**. snforge copies Starknet mainnet at a fixed block and runs the router against the real Vesu vault and real USDC. Nothing is spent.

```bash
cd contracts/vault-router
scarb build
snforge test
```

The tests prove that deposits credit the caller, withdrawals pay the caller and burn only the caller's shares, withdrawing needs a share approval, and a thief with the owner's approval in place still only reaches the thief's own empty position.

## Exercise

1. Install [Scarb and Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/getting-started/installation.html) and run the tests.
2. Break the router on purpose: make `withdraw_to_self` take a `receiver` argument and pass it through. Which test should catch it? Write one that does.
3. Deploy your own router (the README in `contracts/vault-router` has the `sncast` commands) and find it on Voyager.

## Test

```bash
cd contracts/vault-router && snforge test
```
