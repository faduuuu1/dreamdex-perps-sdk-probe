# dreamDEX perps — Markets SDK probe and feedback

A small, read-only tool built against the dreamDEX perps testnet with
[`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk),
plus the feedback items found while building it.

Submitted to the **dreamDEX Perps Builder Bounty**, Feedback track.

## What it does

`list-perp-markets.mjs` reads the live perp market list from the indexer and prints:

- every perp market with last price, mark price, 8h funding, tick size, minimum
  quantity, initial margin and trade count
- duplicate `baseSymbol` values, because symbol is not a unique market key
- which optional indexer fields are populated on each market
- the MarginBank system config from `getPerpSystemConfig`, cross-checked against
  `SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral`
- perp voucher eligibility, when an address is supplied

It sends **no transactions**, needs **no private key** and costs **no gas**, so it
runs on a completely unfunded account.

## Run it

```bash
npm install
node list-perp-markets.mjs
```

Optionally pass an address to also read voucher eligibility:

```bash
node list-perp-markets.mjs 0xYourTradingAccount
```

There is also a minimal repro harness for the intermittent chain-read failure:

```bash
node wstest.mjs omit     # do not pass wsRpcUrl
node wstest.mjs chain    # pass the chain's own WebSocket URL
```

Captured output from both is in [`evidence/`](evidence).

## A note on the network name

This matters more than it looks, so it is worth stating plainly:

| Name in the SDK | Chain ID | `testnet` | What it is |
| --- | --- | --- | --- |
| `hidekiTestnet` | 50383 | `true` | the perps testnet — what this repo targets |
| `somniaTokyo` | 50321 | `false` | a separate, non-testnet chain |

The bounty materials call the target "Somnia Tokyo testnet". That phrase matches
neither name: the perps testnet is **Hideki (50383)**, whose block explorer happens
to sit at a `/tokyo` path, while `somniaTokyo` is chain 50321 with `testnet: false`
and a production indexer. Both have a `perpPoolFactory` deployed, so aiming at the
wrong one does not necessarily fail loudly. See
[`feedback/03-tokyo-vs-hideki-naming.md`](feedback/03-tokyo-vs-hideki-naming.md).

## Network details used

| | |
| --- | --- |
| Chain | Hideki testnet, 50383 |
| Indexer | `https://hideki-dev.smk.somnia.host/v1/graphql` |
| MarginBank | `0x478769E1177C0773c43A593DCCc4Ad15F15F1394` |
| SDK | `@somnia-chain/markets-sdk` 0.33.0 |

## Feedback items

| # | Item | Severity | Area |
| --- | --- | --- | --- |
| 01 | [Chain reads fail intermittently with "genesis check failed"](feedback/01-genesis-check-failed-intermittent.md) | major | SDK |
| 02 | [The documented way to get STT requires STT](feedback/02-link-a-bot-gas-deadlock.md) | major | app |
| 03 | ["Somnia Tokyo testnet" is not a network that exists](feedback/03-tokyo-vs-hideki-naming.md) | major | docs |
| 04 | [Five markets share the baseSymbol LOADTEST](feedback/04-duplicate-loadtest-markets.md) | normal | API |
| 05 | [SDK version cannot be read programmatically](feedback/05-sdk-package-json-not-exported.md) | normal | SDK |
| 06 | [Docs pin 0.32.1 while npm installs 0.33.0](feedback/06-docs-sdk-version-drift.md) | normal | docs |
| 07 | [fundingIntervalSec is validated in two funding helpers and ignored in three](feedback/07-funding-interval-unvalidated-silent-zero.md) | major | SDK |

Each file follows the structure the bounty asks for: title, severity, area, steps to
reproduce, expected, actual, evidence and environment.

No security vulnerabilities are reported here. Per the bounty rules those go
privately to `security@dreamdex.io`, not into a public repository.

## What is deliberately not claimed

While investigating, three things looked like bugs and turned out not to be. They are
listed here because a report that cries wolf is worse than no report:

- **Two RPC hostnames.** The docs give `api.hideki2.infra.testnet.somnia.network`
  while the SDK's chain object carries `api.hideki.infra.testnet.somnia.network`.
  Both answer, both report chain `0xc4cf` (50383), and both serve the identical
  genesis hash. Two names for one network, not a mismatch.
- **Null mark price and funding.** 1 of 40 markets returns `null` for `markPrice`,
  `indexPrice` and the funding fields. That one market is an abandoned `LOADTEST`
  pool, not a gap in the data for real markets.
- **`wsRpcUrl` causing the genesis error.** Passing it explicitly looked like the
  fix at first. Over 12 controlled runs the failure appeared with and without it,
  so it is unrelated. Item 01 reports the flakiness, not a `wsRpcUrl` bug.

## Layout

```
list-perp-markets.mjs   the probe
wstest.mjs              minimal repro for item 01
genkey.mjs              generates a throwaway bot keypair into .env, prints only the address
feedback/               one Markdown file per item
evidence/               captured command output
```

`.env` is git-ignored and holds only a throwaway testnet key. No private key is
committed, printed or sent anywhere.
