# Chain reads fail intermittently with "genesis check failed" although the genesis is stable
Severity: major
Area: SDK

## Steps to reproduce

1. Install `@somnia-chain/markets-sdk` 0.33.0.
2. Construct a client for `hidekiTestnet` and perform one on-chain read:

   ```js
   import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk'
   import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains'

   const markets = new SomniaMarkets({
     chain: hidekiTestnet,
     indexerUrl: 'https://hideki-dev.smk.somnia.host/v1/graphql',
     addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
     wsRpcUrl: hidekiTestnet.rpcUrls.default.webSocket[0], // also fails when omitted
   })

   await markets.client.getPerpSystemConfig(SOMNIA_HIDEKI_TESTNET_ADDRESSES.marginBank)
   ```

3. Run it repeatedly, six times or so. `wstest.mjs` in this repo does exactly this.

## Expected

Each run either succeeds, or fails with an error naming the real cause. Nothing about
the chain changes between runs, so the outcome should be the same every time.

## Actual

Roughly a sixth to a third of runs fail with:

```
@somnia-chain/markets-sdk: rpc getBlock failed: genesis check failed
```

The remaining runs succeed and return the expected config. Nothing in the
configuration differs between a failing run and a passing one.

The message is also misleading. It points at a genesis mismatch, but the genesis
block hash is identical and stable:
`0x555de6145260a388241bea0f9328d57335d330d5a0fbb329de1a4fd1c7f2eb25`, returned by six
consecutive `eth_getBlockByNumber("0x0")` calls on each of the two Hideki RPC
hostnames. Both also report chain `0xc4cf` (50383).

Because the message names the genesis, the obvious debugging path is to go looking
for a chain or endpoint mismatch, which is a dead end. The real behaviour looks like
a transient WebSocket failure surfacing under a wrong label.

This blocks bot development specifically: a strategy loop that calls any chain read
on startup dies on a fraction of launches for no reproducible reason.

## Evidence

Controlled pass, six runs per configuration, same machine, back to back
(`evidence/wsrpcurl-repro.txt`):

| Configuration | Succeeded | Failed |
| --- | --- | --- |
| `wsRpcUrl` omitted | 6 | 0 |
| `wsRpcUrl` set to the chain's own WebSocket URL | 4 | 2 |

Earlier ad-hoc runs failed in the omitted configuration too, so the failure is not
tied to `wsRpcUrl`. Both configurations fail sometimes and succeed sometimes.

The clearest single case rules out configuration entirely. In **one** process, with
one client, two consecutive chain reads disagreed
(`evidence/list-perp-markets.txt`):

```
perp system config for marginBank 0x478769E1177C0773c43A593DCCc4Ad15F15F1394
read failed: @somnia-chain/markets-sdk: rpc getBlock failed: genesis check failed

perp voucher eligibility for 0x9DCd8287446e0DD4D2892F610D047c7F87267A6c
marginBank 0x478769e1177c0773c43a593dccc4ad15f15f1394
  eligible                 true
  grantAmount              1000000000000000000000
```

`getPerpSystemConfig` failed the genesis check, then `getPerpVoucherEligibility`,
also an on-chain read through the same client and socket, succeeded moments later.
Nothing about the chain, the endpoint or the configuration changed in between, so
whatever the genesis check is reacting to, it is not the genesis.

A successful read returns:

```json
{
  "marginBank": "0x478769E1177C0773c43A593DCCc4Ad15F15F1394",
  "collateralToken": "0xed7993A74dAe1e6656B704A424DcD8711aAf4F72",
  "perpPoolFactory": "0xE631fAEE547baeE07353E290f0562ea67d856560",
  "liquidationEngine": "0xA66d3C24Ad4a389d863846905D8173e1017e9F4D",
  "insuranceFund": "0x50826894D47C6D4f3BeA38BFDC7Dc5c5be171b80",
  "feeRecipient": "0xd58596620Ee6951B2958a931949e4ff7ce6222be",
  "maxLeverageLimit": 40,
  "fullyWired": true
}
```

Genesis hash check, 6 reads per endpoint, all identical:

```
https://api.hideki.infra.testnet.somnia.network   0x555de6...f2eb25
https://api.hideki2.infra.testnet.somnia.network  0x555de6...f2eb25
```

Two concrete asks, either of which would help on its own:

- retry the chain handshake, or
- report the transport failure rather than attributing it to the genesis.

## Environment

- SDK version: `@somnia-chain/markets-sdk` 0.33.0
- Network: Somnia Hideki testnet, chain 50383, the network the bounty refers to as
  Somnia Tokyo testnet
- Indexer: `https://hideki-dev.smk.somnia.host/v1/graphql`
- WebSocket: `wss://api.hideki.infra.testnet.somnia.network/ws`
- Node.js 24.19.0 on Windows 10
- Wallet address: `0x9DCd8287446e0DD4D2892F610D047c7F87267A6c` (throwaway, unfunded;
  the failing calls are reads and need no balance)
