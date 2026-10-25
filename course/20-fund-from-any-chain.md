# Module 20. Fund from any chain

Module 17 let a user fund the agent from the Starknet wallet they already have. Most people's USDC isn't on Starknet, though: it sits on Base, Arbitrum or Ethereum. This module brings it over without a bridge token, an exchange or a custodian, through Circle's Cross-Chain Transfer Protocol (CCTP V2): USDC is **burned** on Base and **minted** on Starknet by Circle itself.

## The idea

- **Burn, attest, mint.** The user's EVM wallet calls `depositForBurn` on Circle's `TokenMessengerV2` on Base, naming the Vela wallet as the recipient. Circle watches Base, and once the burn is final it signs an **attestation** of the message. Anyone can then hand the message and the attestation to `receive_message` on Starknet's `MessageTransmitterV2`, which mints the same USDC to the recipient. No pool, no wrapped token: the USDC on Starknet is Circle's native USDC.
- **Two speeds, one honest choice.** *Standard* finality is free and takes as long as Circle needs to be sure Base can't reorganize (it waits for Ethereum finality, about 15 to 20 minutes). *Fast* attests after a few blocks for a fee Circle takes from the amount (1.3 basis points from Base when this was written). The SDK's `cctpQuote` asks Circle for both prices and estimates, and Vela shows both before anything is signed. Whichever the user picks, they pay only Base's gas and, if fast, Circle's fee. Chipi pays the Starknet mint.
- **The only way to lose a deposit is a wrong recipient.** The recipient is a 32-byte field, not a Starknet address; if it encodes the wrong value the USDC mints to an address nobody controls. So the recipient is never typed. It is the Vela wallet, and the SDK's `assertMintRecipient` decodes the encoded field back and compares it before the wallet signs. Every other failure leaves the money *in flight*, not lost.
- **Permissionless finish.** The burn sets `destinationCaller = 0`, so anyone may deliver the mint. Vela registers the burn hash with Chipi the moment it exists, and Chipi's delivery service mints from its own account. The user can close the page. If Chipi's service were down for a day, the message would still be mintable, by Chipi later or by the wallet itself (`buildCctpReceiveMessageCall`).
- **Attestations expire, money doesn't.** A fast attestation carries an `expirationBlock` about 24 hours ahead on the destination chain. If the mint is attempted later, it reverts; Chipi asks Circle to re-attest (`POST /v2/reattest/{nonce}`) and mints with the new signature. Nothing is lost by waiting.
- **The agent can't do any of this.** `deposit_for_burn` is not in the session's whitelist (module 4), so the agent's key can never move the wallet's USDC off Starknet, to any chain or address, past any cap. The user's own key is the only one that could, and Vela never offers it: withdrawals go to the linked Starknet wallet (module 17).

```
Base                                    Circle                              Starknet
────                                    ──────                              ────────
EVM wallet: approve + depositForBurn ──▶ (waits for finality) ──▶ attestation
            │ burn hash                                                        │
            └──▶ Chipi: register-burn ──▶ polls Circle ──▶ receive_message (Chipi pays) ──▶ USDC in the Vela wallet
                                                                               │
Vela (same browser): burn hash in localStorage ──▶ useCctpDepositStatus ──▶ MINTED ──▶ refresh
```

## The code

- `components/fund-from-evm.tsx`: the whole flow, in the "Fund" step of onboarding.
  - `discoverEvmWallets()` lists the EVM wallets in the browser (EIP-6963). One click connects (`eth_requestAccounts`); the USDC balance on Base is read from a public RPC so it works whatever chain the wallet is on.
  - `quote({ chain: BASE, amount })` from `useCrossChainDeposit` returns both speeds (`fee`, `receives`, `eta`). The two buttons show exactly what Circle answered; the ETA text comes from `formatCctpEta`, never from a number typed in Vela.
  - `depositAsync(...)`: the SDK switches the wallet to Base and checks `eth_chainId`, reads the allowance, sends `approve` and `depositForBurn` in one EIP-5792 batch when the wallet can (one prompt) or one after the other (two), checks the receipt's status, registers the burn with Chipi, waits for Chipi's mint and records the deposit in the wallet's history. `onStatus` reports each step with its usual duration; `depositStepLabel` in `lib/fund-from-evm.ts` turns them into sentences.
  - The amount goes through the same `checkDeposit` as module 17: no more than the wallet holds on Base, no more than the room under the beta cap.
- `lib/fund-from-evm.ts`: `savePendingDeposit` / `loadPendingDeposit` keep the burn hash per Vela wallet in `localStorage`; the component follows it with `useCctpDepositStatus` on the next visit **in the same browser** and clears it on `MINTED`. When the browser refuses to store it (private mode, quota), the hash stays in memory and the page says it lives in this tab only. A `CrossChainDepositError` means the burn happened but a later step failed: the hash is kept and shown, with its Basescan link. Whatever happens to the browser, the deposit itself completes: Chipi has the hash from `registerCctpDeposit`. Keeping it in Vela's database too, so the dashboard shows it from any device, is a good exercise.
- `lib/config.ts`: `EVM_DEPOSIT_CHAIN_KEY = "base"`, the one chain Chipi has run real transfers on (`verified: true` in the SDK's `CCTP_EVM_CHAINS`). Arbitrum, Optimism, Polygon and Ethereum are in the SDK too; offering them is one line here and a $1 canary first.
- `lib/__tests__/policy.test.ts`: pins that `sessionEntrypoints()` never contains `deposit_for_burn`, `deposit_for_burn_with_hook` or `receive_message`.

## Exercise

1. Bring 1 USDC from Base at standard speed. Close the tab right after your wallet confirms. Come back 20 minutes later: what does the Fund step show, and where did it get the burn hash from?
2. Quote 1 USDC at both speeds and write down Circle's fast fee. Then burn fast and find the message on Circle's API: `GET https://iris-api.circle.com/v2/messages/6?transactionHash=<burn hash>`. Compare `decodedMessage.decodedMessageBody.feeExecuted` with the quote.
3. In `components/fund-from-evm.tsx`, change `walletAddress: to` to another address and read what `depositAsync` does before your wallet opens. Which SDK function stops it, and why is that check in the SDK rather than in Vela?

## Test

```bash
npx vitest run lib/__tests__/fund-from-evm.test.ts lib/__tests__/policy.test.ts lib/__tests__/wallet-amounts.test.ts
```

## Read

- Chipi docs: [Cross-chain USDC](https://docs.chipipay.com/sdk/guides/cross-chain-usdc) and [useCrossChainDeposit](https://docs.chipipay.com/sdk/nextjs/hooks/use-cross-chain-deposit).
- Circle: [CCTP V2 technical guide](https://developers.circle.com/cctp/references/technical-guide) (the message layout) and [required block confirmations](https://developers.circle.com/cctp/required-block-confirmations) (why standard takes the time it takes).
- Build with Chipi: [tutorial 06, fund from Base](https://github.com/chipi-pay/build-with-chipi/tree/main/tutorials/06-fund-from-base), the same flow in a 300-line app.
