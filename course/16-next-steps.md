# Module 16. Next steps

You built an agent that holds no key of yours, decides with a model, cannot overspend, can be stopped in one tap, and proves everything on-chain. Here is where to take it.

## Ideas

- **Better decisions.** Feed the agent its own history (the `decisions` table) and measure whether its trades beat holding.
- **More guardrails.** A daily loss limit in `decide()`; pausing when signals disagree; a human-in-the-loop for trades above a threshold (a push notification and a passkey prompt).
- **More venues.** Another vault means another router (module 13) and another capped token (module 5). Write the threat model row first.
- **Your own AI endpoint.** Once module 12 ships, point the agent at any x402 seller.
- **Other chains of thought.** Swap Chipi's `think` for `sdk.ai.chat` with your own prompt and keep `decide()` exactly as it is. The harness is what makes any model safe to plug in.

## Read

- Chipi docs: [session keys](https://docs.chipipay.com/sdk/guides/session-keys), [spending policies](https://docs.chipipay.com/sdk/guides/spending-policies), [agent sessions](https://docs.chipipay.com/sdk/guides/agent-sessions), [passkeys](https://docs.chipipay.com/sdk/guides/passkeys).
- [build-with-chipi](https://github.com/chipi-pay/build-with-chipi): tutorials 01–04, from a first wallet to an agent with a session and a passkey.
- [Cairo book](https://book.cairo-lang.org) and [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/).

Ship something, and tell us about it.
