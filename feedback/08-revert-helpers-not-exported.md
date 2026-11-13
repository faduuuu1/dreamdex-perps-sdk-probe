# `decodeRevert` reports transport failures as contract reverts, and the helpers that tell them apart are not exported
Severity: major
Area: SDK

## Steps to reproduce

1. Install `@somnia-chain/markets-sdk` 0.33.0.
2. Check what the package root exports from its revert module:

   ```js
   import * as SDK from '@somnia-chain/markets-sdk'
   SDK.decodeRevert           // function
   SDK.isRevert               // undefined
   SDK.isMissingContractView  // undefined
   SDK.toSdkError             // undefined
   ```

3. Hand the one exported helper a network failure:

   ```js
   const timeout = Object.assign(new Error('fetch failed'),
     { code: 'UND_ERR_CONNECT_TIMEOUT' })

   const e = SDK.decodeRevert(timeout, { functionName: 'getPerpSystemConfig' })
   e.constructor.name  // 'ContractRevertError'
   e.errorName         // undefined
   e.message           // '@somnia-chain/markets-sdk: getPerpSystemConfig reverted: fetch failed'
   ```

4. `revert-classification.mjs` in this repo runs the whole set offline.

## Expected

Either `decodeRevert` declines to classify a failure that never reached the
EVM, or the helpers that make that distinction are reachable by a consumer.

The SDK states why this matters, in `revert.d.ts`:

> The distinction is what decides `ContractRevertError` vs `RpcError`, and it
> matters to callers: a revert will happen again identically, a transport
> failure is worth retrying.

That is a retry decision. A caller cannot make it with what the package exports.

## Actual

Every transport failure comes back as a contract revert:

```
connect timeout  -> ContractRevertError, errorName=undefined, "getPerpSystemConfig reverted: fetch failed"
socket hang up   -> ContractRevertError, errorName=undefined, "getPerpSystemConfig reverted: socket hang up"
dns failure      -> ContractRevertError, errorName=undefined, "getPerpSystemConfig reverted: getaddrinfo ENOTFOUND"
http 429         -> ContractRevertError, errorName=undefined, "getPerpSystemConfig reverted: Too Many Requests"
```

A DNS failure and a rate limit both read as *the contract rejected your call*.
The chain never ran anything in any of these cases.

`revert.js` declares four exports:

```
export declare function isRevert(value: unknown): boolean
export declare function isMissingContractView(err: unknown): boolean
export declare function decodeRevert(caught: unknown, context?): ContractRevertError
export declare function toSdkError(caught: unknown, operation: string, context?): SomniaMarketsSocketFailure
```

The package root re-exports exactly one of them:

```
export { decodeRevert, type RevertContext } from "./revert.js";
```

So the hazardous helper is the reachable one and all three safe ones are not.
The documentation is candid about this, in `decodeRevert`'s own Gotchas:

> Decodes unconditionally: it does not first check whether the failure IS a
> revert, so a transport error (timeout, disconnect) passed here comes back as
> a ContractRevertError with no `errorName`. Callers inside the SDK use the
> internal `isRevert` / `toSdkError` pair to make that distinction; neither is
> exported, so a consumer should pass values it already knows to be revert
> data.

The advice is sound and the hazard is accurately described. The problem is that
"values it already knows to be revert data" is precisely what a consumer cannot
determine, because the predicate that determines it is the thing withheld.

## Why this is major

The failure is silent and it inverts a bot's recovery logic. By the SDK's own
rule a revert "will happen again identically", so the correct response is to
stop and not retry. A strategy loop that trusts the returned type will:

- stop retrying a rate limit, which is the one failure that retrying fixes
- treat an RPC outage as a permanent rejection of its order
- log "reverted" for an incident whose cause was DNS

and `errorName === undefined` is the only hint, which is also what a genuine
revert carrying unrecognized bytes produces. The two are not distinguishable
from the returned error.

`UND_ERR_CONNECT_TIMEOUT` is not a hypothetical here: it is the error this
repo hit against the Hideki indexer while building
[the market probe](../list-perp-markets.mjs), which is why that script wraps the
call in its own try/catch.

This is the same family as
[01-genesis-check-failed-intermittent.md](01-genesis-check-failed-intermittent.md)
— a transport failure surfaced under a chain-level label — but a different
mechanism with a different fix, and the two are independent.

Suggested fix: add `isRevert` and `toSdkError` to the root export list. It is a
one-line change to `index.ts`, the functions already exist and are already
documented, and it turns the Gotchas paragraph from a warning into a remedy.
Guarding `decodeRevert` itself would also work but is a behaviour change;
exporting the predicate is not.

## Evidence

Captured in `evidence/revert-classification.txt`, produced by
`node revert-classification.mjs`:

```
isRevert exported from package root       : false
isMissingContractView exported from root  : false
decodeRevert exported from package root   : true
toSdkError exported from package root     : false

decodeRevert(a connect timeout):
  constructor : ContractRevertError
  errorName   : undefined
  reason      : fetch failed
  data        : undefined
  message     : @somnia-chain/markets-sdk: getPerpSystemConfig reverted: fetch failed
  cause code  : UND_ERR_CONNECT_TIMEOUT
```

The export list quoted above is line 36 of the published `dist/index.d.ts`, and
the four declarations are lines 22, 43, 66 and 85 of `dist/revert.d.ts`.

No chain access is involved: the repro constructs the error objects locally and
runs offline.

## Environment

- SDK version: `@somnia-chain/markets-sdk` 0.33.0
- Network: not network-dependent; the repro is offline and deterministic
- Node.js 24.19.0 on Windows 10
- Wallet address: not applicable, no chain access involved
