# The documented way to get testnet STT requires testnet STT
Severity: major
Area: app

## Steps to reproduce

1. Sign in at `app.testnet.dreamdex.io` with a brand new wallet, so the app wallet
   holds 0.00 STT.
2. Follow the developer documentation for obtaining gas. *Perps on Testnet for
   Developers*, under "Get test funds", gives exactly one route for STT: sign in,
   then Link a Bot with your key's address and use "Send it … for gas" or "Top up".
3. Open **Link a bot** and paste a bot address.
4. Tick the offered gas transfer, "Send it 5 STT for gas".
5. Try to add the bot.

## Expected

Either the bot links, or the app explains where a new account gets its first STT.

## Actual

The dialog refuses with:

```
Can't add a bot yet: the app's key that sends this change has no STT.
```

The gas control in the same dialog reads "From Wallet 1 (0.00 STT)", so the only
funding source the flow offers is the wallet that is empty. Linking a bot is itself
an on-chain change that needs gas, so the documented route to acquire STT cannot run
until STT has already been acquired some other way. For a new account the instruction
is circular.

Nothing on the developers page names an alternative. There is no faucet link for
chain 50383, and the public Somnia faucet at `testnet.somnia.network` serves Shannon,
chain 50312, which is a different network from the one perps run on, so funding an
address there does not help.

The practical effect is that a new builder cannot reach any state-changing part of
the perps testnet, including claiming the paper USDso voucher, without asking a human
in Discord. That is a reasonable fallback but it is not what the documentation says,
and it costs a reviewer a support ticket for every new participant.

Suggested fixes, in rough order of usefulness:

1. State on the developers page that the first STT comes from Perps Arena, or from
   asking in Discord, and that Link a Bot cannot be the first step.
2. Make the error name the fix instead of the symptom, for example "this wallet needs
   STT first — join Perps Arena or ask in Discord".
3. Expose a faucet for chain 50383, even a rate-limited one.

Note that the *Get started* ordering elsewhere in the docs does put Perps Arena before
Link a Bot. The developers page does not repeat that ordering, and it is the page a
builder lands on.

## Evidence

The app's own refusal message, quoted above, with the gas row showing
"From Wallet 1 (0.00 STT)".

The developers page, "Get test funds" section:

> STT for gas. The simplest route is through the app: sign in at
> app.testnet.dreamdex.io, then Link a Bot with your key's address and use
> Send it … for gas or Top up.

Faucet network mismatch, verified by chain ID:

| Network | Chain ID | Public faucet |
| --- | --- | --- |
| Hideki testnet, where perps run | 50383 | none found |
| Shannon testnet, what the Somnia faucet serves | 50312 | `testnet.somnia.network` |

## Environment

- Network: Somnia Hideki testnet, chain 50383, the network the bounty refers to as
  Somnia Tokyo testnet
- App: `app.testnet.dreamdex.io`, region DreamDEX
- SDK version: not involved; this is the app's Link a bot flow
- Wallet address: `0x9DCd8287446e0DD4D2892F610D047c7F87267A6c` (the bot address being
  linked); the app wallet funding the change held 0.00 STT
