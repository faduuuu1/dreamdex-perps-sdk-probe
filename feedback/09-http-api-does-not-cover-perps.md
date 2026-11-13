# Nothing in the HTTP or WebSocket API docs says they do not cover perps, and asking for perps answers 200 with an empty list
Severity: normal
Area: docs

## Steps to reproduce

1. Open *HTTP API → Overview* and read the Base URLs table. Two environments
   are listed: Mainnet (5031) and Testnet (Somnia Shannon, 50312).
2. Note that *Perps on Testnet for Developers* puts perps on **Hideki, chain
   50383** — neither of the two.
3. Query the documented testnet base URL anyway:

   ```sh
   curl "https://stg.api.dreamdex.io/v0/markets"
   curl "https://stg.api.dreamdex.io/v0/markets?kind=perp"
   ```

4. `rest-api-perps.mjs` in this repo runs the whole comparison.

## Expected

One sentence, on the HTTP API overview and on the perps developer page, saying
that the HTTP and WebSocket APIs serve spot and event contracts only, and that
perps on Hideki are reached through the SDK or the GraphQL indexer.

## Actual

Nothing says it, and every signal a developer can check points the wrong way.

The two documented environments both answer, and both serve spot only:

```
mainnet  5031   api.dreamdex.io/v0      -> 200  4 markets, kinds=spot
testnet  50312  stg.api.dreamdex.io/v0  -> 200  3 markets, kinds=spot
```

Asking for perps does not produce an error:

```
/v0/markets?kind=perp  -> 200  0 markets
/v0/perp/markets       -> 404  404 page not found
```

A `200` with an empty list is what a developer gets for the one query that
would tell them the truth. It is indistinguishable from "no perp markets are
live right now", which is the obvious reading, and it is wrong: the Hideki
indexer returns **40**.

No Hideki REST host exists under any name worth guessing — `hideki.api`,
`api.hideki`, `perps.api` and `testnet.api` under `dreamdex.io` all fail DNS.
So this is not a missing base URL in the table; the REST surface for perps does
not exist.

The WebSocket feed is the same family: its documented channels are `orderbook`,
`ohlcv` and `trades`, and its subscription examples use `SOMI:USDso`, the spot
symbol format. Perp markets are not addressable in it either.

## What this report is not claiming

The HTTP API docs never promise perps. The Market Data page lists its symbols
per environment and they are all spot pairs:

> Mainnet (5031): SOMI:USDso, USDC.e:USDso, WBTC:USDso, WETH:USDso
> Testnet (Shannon, 50312): SOMI:USDso, WBTC:USDso, WETH:USDso

Those tables are accurate, and the page is careful elsewhere — it warns that
unknown symbols are silently skipped rather than erroring, which is the same
behaviour `?kind=perp` shows and is therefore working as documented.

So this is not a broken API. It is a missing signpost, in a documentation set
where the HTTP API, the WebSocket API and "Perps on Testnet for Developers" all
sit under the same **DEVELOPERS** heading with nothing to say the first two stop
short of the third.

## Why it is still worth a line of documentation

The whole audience of the Perps Builder Bounty is developers arriving at these
docs to build on perps. The natural first move is to look for a REST API, find
a complete one with Market Data, Trading, Portfolio, Wallets and Builder Fees
sections, and start there. What follows is a 200, three spot markets, and no
indication that the chain is wrong.

It also compounds with two confusions already filed. The faucet the FAQ points
at serves Shannon 50312 while perps need Hideki 50383
([02](02-link-a-bot-gas-deadlock.md)), and "Somnia Tokyo testnet" matches no
network name in the SDK ([03](03-tokyo-vs-hideki-naming.md)). Shannon, Hideki
and Tokyo now appear across the faucet, the SDK chain list and the REST API,
and a newcomer has no map of which is which.

Suggested fix: a sentence in the HTTP API Base URLs section — "These endpoints
serve spot and event-contract markets. Perps on the Hideki testnet are not
exposed here; use `@somnia-chain/markets-sdk` or the GraphQL indexer" — and the
same sentence in reverse on the perps developer page.

## Evidence

Captured in `evidence/rest-api-perps.txt`, produced by
`node rest-api-perps.mjs`:

```
The two environments the HTTP API docs list:
  mainnet  5031   api.dreamdex.io/v0      -> 200  4 markets, kinds=spot
  testnet  50312  stg.api.dreamdex.io/v0  -> 200  3 markets, kinds=spot

Perps run on Hideki 50383. Asking for perps anyway:
  /v0/markets?kind=perp                   -> 200  0 markets, kinds=(none)
  /v0/perp/markets                        -> 404  404 page not found

Is there a Hideki REST host at all?
  hideki.api.dreamdex.io                  -> ERR  fetch failed
  api.hideki.dreamdex.io                  -> ERR  fetch failed
  perps.api.dreamdex.io                   -> ERR  fetch failed
  testnet.api.dreamdex.io                 -> ERR  fetch failed

For comparison, the Hideki GraphQL indexer the SDK uses:
  hideki-dev.smk.somnia.host/v1/graphql   -> 40 perp markets
```

All requests are unauthenticated GETs against public endpoints.

## Environment

- SDK version: `@somnia-chain/markets-sdk` 0.33.0 (used only for the indexer comparison)
- Network: REST `api.dreamdex.io` (5031) and `stg.api.dreamdex.io` (50312); indexer `hideki-dev.smk.somnia.host` (50383)
- Node.js 24.19.0 on Windows 10
- Wallet address: not applicable, no authentication or chain access involved
