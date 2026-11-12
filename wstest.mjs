/**
 * Minimal repro harness for the wsRpcUrl fallback difference.
 *
 *   node wstest.mjs omit      -> do not pass wsRpcUrl at all
 *   node wstest.mjs chain     -> pass hidekiTestnet.rpcUrls.default.webSocket[0]
 *   node wstest.mjs <wss url> -> pass that URL
 *
 * All three target the same chain and the same single on-chain read.
 */
import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk'
import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains'

const mode = process.argv[2] ?? 'omit'
const chainWs = hidekiTestnet.rpcUrls.default.webSocket?.[0]

const opts = {
  chain: hidekiTestnet,
  indexerUrl: 'https://hideki-dev.smk.somnia.host/v1/graphql',
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
}
let label
if (mode === 'omit') {
  label = `wsRpcUrl omitted (chain carries ${chainWs})`
} else if (mode === 'chain') {
  opts.wsRpcUrl = chainWs
  label = `wsRpcUrl = ${chainWs} (same URL, passed explicitly)`
} else {
  opts.wsRpcUrl = mode
  label = `wsRpcUrl = ${mode}`
}

console.log('case:', label)
const markets = new SomniaMarkets(opts)
try {
  const cfg = await markets.client.getPerpSystemConfig(SOMNIA_HIDEKI_TESTNET_ADDRESSES.marginBank)
  console.log('RESULT: ok, fullyWired =', cfg.fullyWired, ', collateralToken =', cfg.collateralToken)
} catch (e) {
  console.log('RESULT: failed ->', e?.shortMessage ?? e?.message ?? e)
}

// Release the WebSocket so the process can exit.
try {
  await markets.close()
} catch {
  process.exit(0)
}
