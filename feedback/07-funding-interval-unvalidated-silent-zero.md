# `fundingIntervalSec` is validated in two funding helpers and ignored in three, so a null interval silently reads as zero funding and as a stale pool
Severity: major
Area: SDK

## Steps to reproduce

1. Install `@somnia-chain/markets-sdk` 0.33.0.
2. Call the funding helpers with an absent settlement interval, which is what a
   null `fundingIntervalSec` from the indexer coerces to:

   ```js
   import { normalizeFundingRate, fundingRatePerInterval, intervalsPerWindow }
     from '@somnia-chain/markets-sdk'

   const rate = -2_500_000_000_000_000n   // a short paying 0.25% per 8h window

   fundingRatePerInterval(rate, 28800, 3600)   // -312500000000000n  correct
   fundingRatePerInterval(rate, 28800, 0)      // 0n
   fundingRatePerInterval(rate, 28800, null)   // 0n
   fundingRatePerInterval(rate, 28800, -3600)  // +312500000000000n  sign flipped
   intervalsPerWindow(28800, 0)                // throws RangeError
   ```

3. `funding-edges.mjs` in this repo runs the whole matrix.

## Expected

The same argument, validated the same way everywhere in the module. The SDK
already has the validator and already applies it to this exact quantity:

```
intervalsPerWindow(28800, 0)  ->  RangeError: fundingIntervalSec must be positive, got 0
```

`fundingRatePerInterval` and `normalizeFundingRate` should refuse a
non-positive interval with the same error rather than returning a number.

## Actual

The **denominator** is validated rigorously. Every bad value is caught with a
clear, specific message:

```
normalizeFundingRate(1e15, 0, 3600)          RangeError: fundingWindowSec must be positive, got 0
normalizeFundingRate(1e15, -1, 3600)         RangeError: fundingWindowSec must be positive, got -1
normalizeFundingRate(1e15, NaN, 3600)        RangeError: fundingWindowSec must be positive, got NaN
normalizeFundingRate(1e15, undefined, 3600)  RangeError: fundingWindowSec must be positive, got undefined
normalizeFundingRate(1e15, null, 3600)       RangeError: fundingWindowSec must be positive, got null
```

The **target** is not validated at all:

```
normalizeFundingRate(1e15, 28800, 0)         0n
normalizeFundingRate(1e15, 28800, null)      0n
normalizeFundingRate(1e15, 28800, -3600)     -125000000000000n
```

`fundingRatePerInterval` passes its `fundingIntervalSec` straight through as
that target, so it inherits all of it.

Two outcomes, both silent:

- **Zero.** A null or zero interval returns `0n`, which reads as "this position
  accrues no funding this settlement". It is indistinguishable from a market
  that genuinely has a zero rate.
- **Sign flip.** A negative interval returns the rate with its sign reversed: a
  short *paying* funding reads as a short *receiving* it.

`NaN` and `undefined` do throw, but with the generic
`The number NaN cannot be converted to a BigInt because it is not an integer`,
not the SDK's own message naming the argument.

## The inconsistency, mapped

Five helpers in `funding.js` take a settlement interval. Three accept any value:

| Helper | Argument | Non-positive interval |
| --- | --- | --- |
| `normalizeFundingRate` | `targetSec` | returns a number |
| `fundingRatePerInterval` | `fundingIntervalSec` | returns a number |
| `isFundingStale` | `fundingIntervalSec` | returns `true` |
| `intervalsPerWindow` | `fundingIntervalSec` | **throws RangeError** |
| `densifyFundingBuckets` | `intervalSeconds` | **throws RangeError** |

`isFundingStale` is the clearest symptom. A pool that settled **ten seconds
ago** is reported stale:

```
isFundingStale(fresh 10s ago, interval=3600)   => false
isFundingStale(fresh 10s ago, interval=0)      => true
isFundingStale(fresh 10s ago, interval=-3600)  => true
isFundingStale(fresh 10s ago, interval=null)   => true
```

With a zero interval the staleness threshold collapses to zero, so any elapsed
time at all exceeds it. That direction is at least fail-safe - a bot sees a
false alarm rather than a false all-clear - but it is the same missing guard,
and it means one null field changes the answer of three different functions
without any of them saying so.

`densifyFundingBuckets` shows the fix is already house style: it rejects a
non-positive `intervalSeconds` with `intervalSeconds must be positive, got 0`.
Its other documented invariants hold too - output is oldest-first, filled slots
carry `coverage: "0"` and `filled: true`, and it never fills a slot older than
the oldest row it was given. The module is careful. These three helpers are the
gap in it.

## Why this is major rather than cosmetic

This module's package documentation is explicit about the failure mode it is
built to prevent:

> hardcoding the denominator is the single most expensive mistake available
> here, and it produces a plausible-looking chart rather than an error.

A silent `0n` is the same class of failure arriving through the front door. It
is a money quantity: `fundingRatePerInterval` is documented as "what an account
actually pays or receives at each settlement".

It is also reachable from real indexer data rather than only from programmer
error. Optional funding fields do come back null on live pools - see
[04-duplicate-loadtest-markets.md](04-duplicate-loadtest-markets.md), where a
live pool returns null `fundingRate` and null `fundingWindowSec`. A consumer
doing the natural thing:

```js
fundingRatePerInterval(m.fundingRate, m.fundingWindowSec, m.fundingIntervalSec)
```

is protected when `fundingWindowSec` is the null one and unprotected when
`fundingIntervalSec` is. The guard that fires depends on which field happens to
be missing.

Suggested fix: run the existing positive-integer check on `targetSec` in
`normalizeFundingRate`, with the same message shape already used for
`fundingWindowSec` and by `intervalsPerWindow`. One guard, and all three
behaviours above become errors.

## Evidence

Full matrix captured in `evidence/funding-edges.txt`, produced by
`node funding-edges.mjs`. The decisive rows:

```
normalizeFundingRate(1e15, 0, 3600)      window=0     => THROWS RangeError: fundingWindowSec must be positive, got 0
normalizeFundingRate(1e15, 28800, 0)     target=0     => 0n
normalizeFundingRate(1e15, 28800, null)  target=null  => 0n
normalizeFundingRate(1e15, 28800, -3600) target<0     => -125000000000000n
intervalsPerWindow(28800, 0)             same arg     => THROWS RangeError: fundingIntervalSec must be positive, got 0
fundingRatePerInterval(-2.5e15, 28800, 3600)  ok      => -312500000000000n
fundingRatePerInterval(-2.5e15, 28800, 0)     zero    => 0n
fundingRatePerInterval(-2.5e15, 28800, null)  zero    => 0n
fundingRatePerInterval(-2.5e15, 28800, -3600) flip    => 312500000000000n
```

The documented behaviour these contradict, from `funding.d.ts`:

> `rate_target = rate * targetSec / fundingWindowSec`, in 1e18 fixed point.
> Truncates toward zero, matching the contract's integer arithmetic; sign is
> preserved.

Sign is preserved for the rate, but a negative `targetSec` reverses it, and no
documented range is stated for `targetSec` at all.

No chain access is involved: these are pure functions and the repro runs
offline.

## Environment

- SDK version: `@somnia-chain/markets-sdk` 0.33.0
- Network: not network-dependent; the repro is offline and deterministic
- Node.js 24.19.0 on Windows 10
- Wallet address: not applicable, no chain access involved
