# "Somnia Tokyo testnet" is not a network that exists, and the name that matches is not a testnet
Severity: major
Area: docs

## Steps to reproduce

1. Read the bounty materials. The DoraHacks page and the Discord access post both
   name the target network "Somnia Tokyo testnet", in the submission requirements
   ("a transaction hash from your code on Somnia Tokyo testnet"), in the MVP rules
   ("Your MVP places real perps orders on Somnia Tokyo testnet") and in the
   suggested environment line of the feedback template.
2. Go looking for that network in the SDK:

   ```js
   import { hidekiTestnet, somniaTokyo } from '@somnia-chain/markets-sdk/chains'
   console.log(hidekiTestnet.id, hidekiTestnet.testnet) // 50383 true
   console.log(somniaTokyo.id, somniaTokyo.testnet)     // 50321 false
   ```

3. Check which address constants exist: both `SOMNIA_HIDEKI_TESTNET_ADDRESSES` and
   `SOMNIA_TOKYO_ADDRESSES` are exported, and both contain a `perpPoolFactory`.

## Expected

The name used throughout the bounty resolves to one obvious chain and one obvious
set of address constants.

## Actual

There is no network called "Somnia Tokyo testnet". The two candidates are different
chains, and the one whose name matches the phrase is the wrong one:

| SDK name | Chain ID | `testnet` | Indexer | Has `perpPoolFactory` |
| --- | --- | --- | --- | --- |
| `hidekiTestnet` | 50383 | `true` | `hideki-dev.smk.somnia.host` | yes |
| `somniaTokyo` | 50321 | `false` | `tokyo-prd.smk.somnia.host` | yes |

A builder matching on the word "Tokyo" picks `somniaTokyo` and
`SOMNIA_TOKYO_ADDRESSES`, which is chain 50321 with `testnet: false` against a
production indexer. Because that chain also has perps contracts deployed, the mistake
does not necessarily announce itself: the client constructs, markets may list, and the
builder believes they are on the bounty's testnet.

The confusion has a real root rather than being arbitrary. Hideki's own block
explorer is at `explorer.testnet.somnia.network/tokyo`, so "Tokyo" genuinely does
describe the testnet in one place, while naming a separate production chain in
another. The SDK's own reference table is internally consistent and lists
"Somnia Tokyo (50321)" without the word testnet. It is the bounty copy that merges
the two.

Suggested fix: say "Somnia Hideki testnet (chain 50383)" in the bounty materials and
the submission template, and add one line to the networks reference noting that
`somniaTokyo` (50321) is not the perps testnet despite the explorer path.

## Evidence

Chain objects as exported by the SDK:

```
hidekiTestnet   id=50383  testnet=true   rpc=https://api.hideki.infra.testnet.somnia.network
                                         explorer=https://explorer.testnet.somnia.network/tokyo
somniaTokyo     id=50321  testnet=false  rpc=https://api.tokyo.infra.mainnet.somnia.network
                                         explorer=https://explorer.somnia.network/tokyo
```

Note that `somniaTokyo`'s RPC host contains `mainnet`.

Address constants differ, 14 keys against 12, and are not the same deployment:

```
SOMNIA_HIDEKI_TESTNET_ADDRESSES: binaryModule, binaryPoolBeacon, binaryPoolImpl,
  binarySettlement, clobFactory, collateral, marginBank, marketCreator,
  marketCreatorFactory, marketsCore, oracleHub, perpPoolFactory,
  priceFeedScheduler, testUsdc

SOMNIA_TOKYO_ADDRESSES: binaryModule, binaryPoolBeacon, binaryPoolImpl,
  binarySettlement, clobFactory, marginBank, marketCreatorFactory, marketsCore,
  operatorPermissionsRegistry, oracleHub, perpPoolFactory, priceFeedScheduler
```

Every live market on 50383 confirms the chain in its own row: `chainId: 50383`.

## Environment

- SDK version: `@somnia-chain/markets-sdk` 0.33.0
- Network: Somnia Hideki testnet, chain 50383, the network the bounty refers to as
  Somnia Tokyo testnet
- Wallet address: `0x9DCd8287446e0DD4D2892F610D047c7F87267A6c` (throwaway; this item
  needs no balance to reproduce)
