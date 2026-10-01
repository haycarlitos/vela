# Module 2. Your face is your key

A seed phrase is a private key written on paper. Lose it and the money is gone; show it and the money is someone else's. Passkeys fix both problems for most people.

## The idea

- **A passkey** is a key pair that lives in your phone or laptop's secure hardware, unlocked by your face or fingerprint (WebAuthn). It never leaves the device, and it syncs through your iCloud or Google account.
- **PRF.** A passkey can also produce a secret: the same 32 bytes every time you unlock it on this site, and nothing for any other site. Vela uses that secret to **encrypt your wallet's private key in the browser**. Chipi stores only the ciphertext. Nobody but your passkey can decrypt it: that is **self-custody**.
- **Two passkeys, two jobs.**
  - Your **account passkey** proves to your Vela who you are (sign in).
  - Your **wallet passkey** decrypts your wallet key. It is asked only when you sign something with the wallet (hire or stop the agent).
- **How Chipi trusts your app's users.** After sign-in, your app signs a short-lived token (a JWT, RS256) that says "this is user X". Chipi checks the signature against your app's public key at `/api/auth/jwks`, the URL you gave it in module 0. No shared password between your app and Chipi.

```
sign in ──▶ account passkey ──▶ Better Auth session ──▶ /api/auth/token (JWT, 15 min) ──▶ Chipi
create wallet ──▶ wallet passkey ──PRF──▶ encryption key ──▶ encrypts the wallet key in the browser
```

## The code

- `lib/auth.ts`: Better Auth with three plugins. `anonymous` + `passkey`: an account with no email that gets a passkey right away. `jwt`: signs RS256 tokens with one key, which is what Chipi's Better Auth validator expects. `currentUserId()` is how API routes know who is calling.
- `lib/auth-client.ts`: `getChipiToken()` fetches a fresh JWT right before each Chipi call.
- `components/onboarding/create-account.tsx`: sign up = `signIn.anonymous()` + `passkey.addPasskey()`; sign in = `signIn.passkey()`.
- `components/onboarding/create-wallet.tsx`: `useCreateWallet({ usePasskey: true })` creates the wallet passkey, derives the PRF key and creates the wallet. The SDK refuses (`PRF_UNSUPPORTED`) on a device without PRF instead of silently making a custodial wallet.

## Exercise

1. Create an account, sign out, and sign in again with the passkey on another device that syncs it.
2. Decode a token: in the browser console run `await (await fetch("/api/auth/token")).json()` and paste the token into [jwt.io](https://jwt.io). Find `sub` (your user id, the one Chipi uses) and `exp`.

## Test

```bash
npx vitest run lib/__tests__/auth.test.ts
```
