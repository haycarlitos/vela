# Module 19. Recover a lost passkey

Module 18 added a second key. This one uses it: a user who lost every device with their passkey gets their wallet back on a new device, with a new passkey, and the lost key stops working.

## The idea

- **Recovery adds, it doesn't replace.** `finalize_recovery` adds a new owner. The lost key is still owner 0.
- **Owner 0 matters.** Every passkey call (`registerSession`, `callAnyContract`, `revokeSession`) signs as owner 0. A recovered key sitting at owner N couldn't use any of them. So a recovery ends by **rotating owner 0** onto a new key K. That also takes all power away from the lost key.
- **Two keys, because a wallet can't have the same key twice.** The guardian recovers to a temporary key R. R rotates owner 0 onto K and removes itself.
- **Verify, then store.** Chipi keeps the user's encrypted key on the wallet record. Vela replaces it only after the chain shows that owner 0 is K. Overwriting it earlier would let anyone who starts a recovery lock out the real owner.
- **The server holds ciphertext only.** R and K are made in the browser and encrypted with the new passkey's PRF secret. A passkey without PRF is refused: its key could be derived from data the server has.
- **Loud on purpose.** For the 7 days, the dashboard banner (module 18) shows the pending recovery, and the old passkey can cancel it.

```
guardian (recovery wallet), about 8 days
  sign in with your linked Starknet wallet ──▶ new passkey ──▶ R and K, encrypted
  Bramble: initiate_recovery(R) ── 7 days ──▶ finalize (server, gasless): R is owner N
  R: propose rotate owner 0 → K, propose remove N ── 24 h ──▶ R: execute both
  server: owner 0 is K? ──▶ updateWalletEncryption(K, new passkey)

co-owner, about 1 day
  Bramble: propose rotate owner 0 → K ── 24 h ──▶ Bramble: execute ──▶ same check and store
```

## The code

- `lib/recovery.ts`:
  - `recoveryNewOwner` and `expectedRecoveryHash`: the owner a recovery adds, and the commitment `get_pending_recovery` shows for it (the add-owner payload).
  - `findRotationOps`: a proposal counts only if its `OpProposed` payloads equal `rotateOwnerPayload(0, starkOwnerId(K))` and, on the guardian path, `removeOwnerPayload(N)`.
  - `recoveryStep`: the record plus the chain, turned into one step: approve, waiting, finalize, propose, waiting, activate, store, done.
- `app/api/recovery/route.ts`: one row per user in `recoveries`. Every step is a transaction hash the server waits for and checks against the chain. The last step calls `chipi().updateWalletEncryption({ ..., credentialId, prfSupported: true, authMethod: "passkey" })` only when owner 0 is K. Then it deletes the ciphertexts.
- `components/recover/recover-flow.tsx`, at `/recover`:
  - `createWalletPasskey` and `createStarkOwnerKey` make the new passkey and the keys.
  - `useExternalSignerExecute` lets Bramble sign as its owner id.
  - `useStarkKeyExecute` lets R sign as owner N, decrypted with `getWalletEncryptKey` + `decryptPrivateKey` right before it signs.
- Signing in on the new device is Sign in with Starknet (module 17), so it must be the wallet linked to the account. The trusted-wallets card warns when none is linked.

## Exercise

1. On a test wallet with Bramble as co-owner, open `/recover` in a private window, sign in with Bramble, and recover. After 24 hours, call `get_owner(0)` on Voyager: whose key is it now?
2. With a recovery wallet instead, start a recovery and open your dashboard with your old passkey. What does the banner say, and what would cancelling it do to `/recover`?
3. Why does the server check owner 0 before `updateWalletEncryption`, and not just the transaction's success?

## Test

```bash
npx vitest run lib/__tests__/recovery.test.ts app/api/recovery/__tests__/route.test.ts
```

## Read

- Chipi docs: [guardian recovery](https://docs.chipipay.com/services/gasless/recovery) and [trusted wallets](https://docs.chipipay.com/sdk/guides/trusted-wallets).
