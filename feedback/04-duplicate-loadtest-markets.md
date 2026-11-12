# Five load-test markets share one baseSymbol, and the documented lookup pattern picks one at random
Severity: normal
Area: API

## Steps to reproduce

1. List the perp markets on Hideki testnet:

   ```js
   const perps = await markets.client.listPerpMarkets()
   console.log(perps.length) // 40
   ```

2. Group them by `baseSymbol` and look for repeats:

   ```js
   const counts = new Map()
   for (const m of perps) counts.set(m.baseSymbol, (counts.get(m.baseSymbol) ?? 0) + 1)
   console.log([...counts].filter(([, n]) => n > 1)) // [ [ 'LOADTEST', 5 ] ]
   ```

3. Now apply the lookup pattern the developers page demonstrates:

   ```js
   const btc = perps.find((m) => m.baseSymbol === "BTC")!
   ```

## Expected

Either `baseSymbol` is unique within a network, so the documented `find` is safe, or
the docs use the unique key and say why.

## Actual

40 markets come back, of which 5 are distinct pools all carrying `baseSymbol`
`LOADTEST`. They are separate markets with separate pool addresses, prices and trade
counts, not duplicates of one row.

Two consequences:

**The documented lookup is unsound in general.** `perps.find(m => m.baseSymbol ===
...)` returns whichever pool the indexer happens to order first. For `BTC` today that
is harmless because `BTC` appears once. The pattern is what a builder copies, though,
and it silently resolves to an arbitrary market the moment a symbol repeats. A bot
built on it would place orders into a different pool than intended without any error.
Keying on `poolAddress` is the correct advice.

**Load-test fixtures are in the developer-facing market list.** One of the five is
abandoned: it is the single market out of 40 that returns `null` for `markPrice`,
`indexPrice`, `fundingRate`, `cumulativeFundingPerUnit`, `fundingUpdatedAt`,
`fundingWindowSec` and `fundingIntervalSec`, while still reporting a `lastPrice` of
2403.52 and 2498 trades. Anything iterating all markets and reading mark price or
funding has to special-case it. It is the exact shape of row that breaks a naive
dashboard or a funding-carry strategy that assumes those fields exist.

Suggested fix: either exclude load-test pools from the public indexer response, or
give them a flag so they can be filtered, and change the docs' lookup example to key
on `poolAddress`.

## Evidence

From `node list-perp-markets.mjs` (`evidence/list-perp-markets.txt`):

```
total perp markets: 40

duplicate baseSymbol values (symbol is NOT a unique market key)
LOADTEST       5 markets
               0x736850b162802db2b54d766c686e65e1b31eb954
               0x7d19508851d5397fd0e3b648fe30982bf86268a5
               0xf909076d4abc6e7993e499b533e2b2a8cfbe4dd4
               0xb738977760660b455b0ef9e7fa3eec0205c1292d
               0x7982b98b08f9956e6665366ae93c466b44b044a5

indexer field coverage
markPrice                  39/40     missing: LOADTEST
indexPrice                 39/40     missing: LOADTEST
fundingRate                39/40     missing: LOADTEST
cumulativeFundingPerUnit   39/40     missing: LOADTEST
fundingUpdatedAt           39/40     missing: LOADTEST
fundingWindowSec           39/40     missing: LOADTEST
fundingIntervalSec         39/40     missing: LOADTEST
stopRegistry               34/40     missing: ADLT, LOADTEST, LOADTEST, LOADTEST, LOADTEST, LOADTEST
```

The abandoned pool, `0x736850b1...b31eb954`, in full:

```json
{
  "baseSymbol": "LOADTEST", "quoteSymbol": "USDso",
  "lastPrice": "2403520000000000000000", "tradeCount": "2498",
  "markPrice": null, "indexPrice": null, "fundingRate": null,
  "fundingWindowSec": null, "fundingIntervalSec": null,
  "openInterest": "0", "chainId": 50383
}
```

## Environment

- SDK version: `@somnia-chain/markets-sdk` 0.33.0
- Network: Somnia Hideki testnet, chain 50383, the network the bounty refers to as
  Somnia Tokyo testnet
- Indexer: `https://hideki-dev.smk.somnia.host/v1/graphql`
- Wallet address: `0x9DCd8287446e0DD4D2892F610D047c7F87267A6c` (throwaway; this item
  is a read and needs no balance)
