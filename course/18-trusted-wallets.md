# Module 18. Trusted wallets

A passkey is a good key until you lose every device that holds it. This module adds a second key to the Vela wallet: the Starknet wallet the user already has (Bramble, Braavos, Ready). Its key never leaves that wallet, and adding it takes the wallet contract's own timelock.

## The idea

- **A wallet contract can have several owners.** The Vela wallet (SHHH) keeps a list of keys, each with a *kind* (how its signature is checked), a *role* and a *weight*. The passkey is owner 0.
- **Two roles.**
  - **Recovery wallet** (`GUARDIAN`): it can sign exactly one thing, `initiate_recovery`, which adds a new owner after **7 days** unless the passkey cancels it. It can't move funds or approve anything else.
  - **Co-owner** (`OWNER`): it can sign anything the passkey can, including approving and stopping the agent. Full control: only add a wallet you would trust with the money.
- **A browser wallet signs typed data, not raw hashes.** `wallet_signTypedData` wraps what it signs in its own SNIP-12 message. So these wallets join as the `STARK_SNIP12` kind: its verifier rebuilds that message (it names the Vela wallet, so a signature only works there) and checks the STARK signature.
- **Changing owners takes 48 hours.** Adding a key is a governance change: the passkey *proposes* it, the contract waits 48 hours, and then it can be *executed*. If someone else ever got your passkey for a moment, those 48 hours are your window to notice and cancel. A wallet starts with the `STARK` kind only, so the first time it also proposes the `STARK_SNIP12` verifier.
- **Execution is open to anyone.** After the timelock, anyone may execute a proposal (the arguments are public in the proposal). Removing a pending one therefore means cancelling it on-chain, not just forgetting it.

```
pick wallet ──▶ wallet_signTypedData(approval) ──▶ resolveStarkSnip12Signer ──▶ its STARK key
passkey ──▶ propose_add_verifier_class + propose_add_owner ──▶ 48 h ──▶ passkey ──▶ execute both ──▶ owner #N
```

## The code

- `lib/trusted-wallets.ts`: the two roles, the owner the contract adds (`trustedOwnerInput`: kind, `[stark key, account address]`, role, weight 1, label), and `trustedStep`, which turns the stored record, the wallet's owners and the proposal's ops into one of `confirmed`, `waiting`, `ready`, `expired` or `active`.
- `components/dashboard/trusted-wallets.tsx`: the three clicks. Confirm the key (one signature in the user's wallet, which approves nothing), propose (one passkey prompt), activate after 48 hours (one passkey prompt). It reads the owners with `readShhhOwners` and the timelocks from the proposal's receipt with `parseOpProposedEvents`.
- `app/api/trusted-wallets/route.ts`: stores the record in Postgres, so the user can propose on one device and activate on another. The database must never stop describing what the chain can still do:
  - a proposal's hash is accepted only if its receipt holds the `ADD_OWNER` op for exactly that key, role and label (`addOwnerPayload` equals the op's payload);
  - a record with a proposal can't be overwritten, and it is forgotten or deleted only when `readPendingOp` says the proposal can no longer add the owner (cancelled or expired, never executed).

## Exercise

1. Add your Bramble as a recovery wallet. In the proposal's transaction on Voyager, find the `OpProposed` events: what are `valid_after` and `expires_at`?
2. Propose a second trusted wallet, then cancel it. Which call did your passkey sign, and why isn't deleting the database row enough?
3. After 48 hours, activate it and call `get_owner` on your wallet contract with the new owner id. Which role and label did it get?

## Test

```bash
npx vitest run lib/__tests__/trusted-wallets.test.ts app/api/trusted-wallets/__tests__/route.test.ts
```

## Read

- Chipi docs: [trusted wallets](https://docs.chipipay.com/sdk/guides/trusted-wallets) and [recovery](https://docs.chipipay.com/services/gasless/recovery).
- [build-with-chipi tutorial 05](https://github.com/chipi-pay/build-with-chipi/tree/main/tutorials/05-bramble-trusted-wallet): the same flow, step by step.
