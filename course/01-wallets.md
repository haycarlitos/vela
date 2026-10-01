# Module 1. What is a wallet?

A wallet does not hold money. The money is a number in a contract on the blockchain; the wallet holds the **key** that can change that number.

## The idea

- **A key pair.** A private key (a big secret number) and the public key derived from it. Whoever knows the private key can sign. Signing is how you say "I approve this".
- **An address.** Where your tokens are recorded. On Starknet every account is itself a **smart contract** (a "smart account"): it decides what counts as a valid signature. That is what lets later modules add passkeys and session keys without changing the address.
- **Tokens are contracts too.** USDC on Starknet is a contract at `0x0330…35fb` that keeps a table `address → balance`. Your "balance" is a row in that table.
- **Decimals.** Contracts only store integers. USDC uses 6 decimals, so `1_000_000` means 1 USDC. ETH and STRK use 18. Mixing them up is the most common money bug there is.

```
USDC contract                       your wallet contract
┌────────────────────────────┐      ┌──────────────────────────┐
│ balances:                  │      │ who may sign:            │
│   0xYOU   → 12_500_000     │◀────▶│   your passkey key       │
│   0xSHOP  →  3_000_000     │      │   (module 4: a session)  │
└────────────────────────────┘      └──────────────────────────┘
       = 12.5 USDC
```

## The code

- `lib/config.ts`: the token addresses (`TOKENS`) and `TOKEN_DECIMALS`. Vela uses native USDC, not the bridged USDC.e: same name, different contract.
- `lib/portfolio.ts`: `getPortfolio` reads the three balances through Chipi (`getTokenBalance`), the prices (`sdk.ai.prices`), and the USDC you have in Vesu, then values everything in USD.
- `lib/policy.ts`: `usdToBaseUnits` turns "$5 of ETH" into the integer the contract understands, rounding **down** so it never asks for more than you have.

## Exercise

1. Open your wallet address (the dashboard shows it) on [Voyager](https://voyager.online). Find the USDC balance and the contract it comes from.
2. Send yourself $5 of USDC on Starknet. Watch the number change, in base units on Voyager and in dollars in Vela.

## Test

```bash
npx vitest run lib/__tests__/policy.test.ts -t usdToBaseUnits
```
