# Module 17. Bring your own wallet

Many people who try Vela already have a Starknet wallet: Bramble, Braavos or Ready. Asking them for an email, or making them start over, sends them away. This module lets them sign in with that wallet, fund the agent from it, and get their money back to it.

## The idea

- **Their wallet can't hold the agent's key.** The agent needs a session key with caps per trade and per day, enforced by the wallet contract (modules 4 and 5). Bramble's default account (OpenZeppelin) has no sessions. Ready's sessions are checked off-chain by Ready's server, and Braavos caps only a total per session. So the agent keeps its own Chipi wallet, and the user's wallet gets three other jobs:
  - **identity**: it signs you in;
  - **funding**: it sends USDC to the agent's wallet;
  - **destination**: withdrawals go back to it.
- **Sign in with Starknet (SIWS).** The server issues a one-time **nonce**. The wallet signs a SNIP-12 message that contains it. The server asks the account contract itself, `is_valid_signature(hash, signature)`, and accepts only `'VALID'`. No email, no password, and Vela never sees the wallet's key.
- **Replay.** A signature is a piece of data: anyone who sees it can send it again. The nonce makes each one good for a single sign-in, for 10 minutes, on this domain only (the domain and the chain are in the signed message).
- **Accounts that don't exist yet.** A new Bramble or Ready account is *counterfactual*: it has an address but is not deployed until its first transaction, so there is no contract to ask. The wallet's `wallet_deploymentData` says what it will deploy as (class, salt, constructor arguments). The server recomputes the address from those, takes the public key from the constructor arguments, and checks the signature with plain ECDSA.

```
pick wallet ──▶ wallet_requestAccounts ──▶ POST /starknet/nonce ──▶ typed data
click again ──▶ wallet_signTypedData ──▶ POST /starknet/verify ──▶ is_valid_signature (or deploymentData + ECDSA) ──▶ session
```

## The code

- `lib/auth-starknet.ts`: a Better Auth plugin with two endpoints. `/starknet/nonce` stores the nonce (Better Auth's `verification` table) and returns the typed data from the SDK's `createStarknetSignInTypedData`. `/starknet/verify` consumes the nonce (once, atomically), rebuilds the message, checks it with `verifyStarknetSignIn`, then signs in, creates the account, or links the wallet to the signed-in account. The link is a Better Auth account with provider `starknet`.
- `lib/starknet-wallet.ts`: finds the wallets in the browser (`@starknet-io/get-starknet-discovery`) and talks to them through the standard wallet API. It follows the strictest wallet's rules: no `undefined` in params, no `api_version`, chain ids compared as numbers, lowercase addresses.
- `components/starknet-wallet-sign-in.tsx`: two clicks on purpose. Wallets like Bramble open their panel only from a click, so connecting and signing each get one.
- `components/send-from-wallet.tsx`: one USDC `transfer` that the user's wallet shows and signs. Their wallet pays its own fee, in STRK.
- `components/dashboard/linked-wallet.tsx`: withdraws USDC to the linked address, signed in the browser with the passkey (the owner key never leaves it).

## Exercise

1. Sign in with Bramble on a brand-new account (never used). Which path checked your signature: `is_valid_signature` or the deployment data? How can you tell from the server's answer?
2. Copy the `nonce` and `signature` from the network tab and send `/starknet/verify` again. What happens, and which line of `auth-starknet.ts` stops it?
3. Fund the agent's wallet with 1 USDC from your wallet, then withdraw 0.5. Find both transfers on Voyager.

## Test

```bash
npx vitest run lib/__tests__/auth-starknet.test.ts lib/__tests__/starknet-wallet.test.ts lib/__tests__/wallet-amounts.test.ts
```

## Read

- [Sign in with Starknet](https://docs.chipipay.com/sdk/guides/sign-in-with-starknet), the SDK guide
- [SNIP-12](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-12.md), typed data on Starknet
- [SNIP-6](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-6.md), `is_valid_signature`
