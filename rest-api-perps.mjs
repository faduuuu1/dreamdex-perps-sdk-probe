/**
 * Does the documented HTTP API reach perps? Read-only, unauthenticated.
 *   node rest-api-perps.mjs
 */
async function probe(url) {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
    const t = await r.text()
    try {
      const j = JSON.parse(t)
      const ms = j.markets ?? j
      if (Array.isArray(ms)) {
        const kinds = [...new Set(ms.map((m) => m.kind ?? '?'))].join('/') || '(none)'
        return `${r.status}  ${ms.length} markets, kinds=${kinds}`
      }
      return `${r.status}  keys: ${Object.keys(j).slice(0, 6).join(',')}`
    } catch { return `${r.status}  ${t.slice(0, 56)}` }
  } catch (e) { return `ERR  ${String(e.message).slice(0, 44)}` }
}

console.log('The two environments the HTTP API docs list:')
console.log('  mainnet  5031   api.dreamdex.io/v0      ->', await probe('https://api.dreamdex.io/v0/markets'))
console.log('  testnet  50312  stg.api.dreamdex.io/v0  ->', await probe('https://stg.api.dreamdex.io/v0/markets'))
console.log('')
console.log('Perps run on Hideki 50383. Asking for perps anyway:')
console.log('  /v0/markets?kind=perp                   ->', await probe('https://stg.api.dreamdex.io/v0/markets?kind=perp'))
console.log('  /v0/perp/markets                        ->', await probe('https://stg.api.dreamdex.io/v0/perp/markets'))
console.log('')
console.log('Is there a Hideki REST host at all?')
for (const h of ['hideki.api.dreamdex.io', 'api.hideki.dreamdex.io', 'perps.api.dreamdex.io', 'testnet.api.dreamdex.io']) {
  console.log(`  ${h.padEnd(40)}->`, await probe(`https://${h}/v0/markets`))
}
console.log('')
console.log('For comparison, the Hideki GraphQL indexer the SDK uses:')
const { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } = await import('@somnia-chain/markets-sdk')
const { hidekiTestnet } = await import('@somnia-chain/markets-sdk/chains')
const markets = new SomniaMarkets({
  chain: hidekiTestnet,
  indexerUrl: 'https://hideki-dev.smk.somnia.host/v1/graphql',
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
})
const perps = await markets.client.listPerpMarkets()
console.log(`  hideki-dev.smk.somnia.host/v1/graphql   -> ${perps.length} perp markets`)
await markets.close()
