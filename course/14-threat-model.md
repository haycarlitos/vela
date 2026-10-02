# Module 14. Threat model

Security is not "nothing can go wrong". It is knowing exactly what can, and making the worst case small and acceptable.

## Who can do what

| Attacker has | They can | They cannot | Why |
|---|---|---|---|
| Your passkey | Everything | | It is the owner key. Keep your device locked. |
| Vela's database only | Read who has an agent and its history | Sign anything | Session keys are encrypted with a key derived from your Chipi secret |
| Database + Chipi secret key (or `VELA_SESSION_SECRET`, if you set one) | Act as every agent | Exceed any cap, act after expiry or revocation, move the owner key | The wallet contract enforces the session limits |
| A bug in Vela | Make bad decisions | Exceed the caps | Same: two guards, `decide()` and the contract |
| A malicious model answer | Suggest anything | Get past `decide()` | Module 9 |
| A copy of an old session key | Nothing, once you stop the agent | | `revokeSession` |

## The worst case, in numbers

With a leaked session key and a `$5` max trade, per day:

```
USDC   4 × 5.25  = $21
ETH    4 × 7.50  = $30   (at hire-time prices)
STRK   4 × 7.50  = $30
                 ≈ $81 a day, until you press Stop or the session expires (7 days)
```

Plus, until the vault router is in place, the Vesu position (module 13). And Vela refuses to manage wallets above `MAX_DEPOSIT_USD` ($100 by default) while the wallet contract's audit is pending. Those two lines are your real risk budget. Write yours down.

## Exercise: red-team your agent

With a $1 max trade and $5 in the wallet:

1. From a script with your session key, try an `approve` of 2 USDC to any address. What does the receipt say? Did a `Transfer` or `Approval` happen?
2. Try a `transfer` of USDC. The receipt says succeeded: did a `Transfer` happen? Why not, even though the amount is small?
3. Stop the agent and try again with the same key.

Write down each result next to the row of the table above that predicts it.

## Read

`SECURITY.md` in this repo: the same model, kept up to date with the code.
