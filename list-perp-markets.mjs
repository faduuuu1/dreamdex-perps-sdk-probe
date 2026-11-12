/**
 * Read-only inventory of dreamDEX perp markets on Somnia Hideki testnet (50383).
 *
 * Uses @somnia-chain/markets-sdk. Sends no transactions, needs no private key
 * and costs no gas, so it runs fine on an unfunded account.
 *
 *   node list-perp-markets.mjs [0xYourTradingAccount]
 *
 * Passing an address additionally reads perp voucher eligibility (also read-only).
 *
 * NETWORK NAMING - read this before changing the chain:
 *   hidekiTestnet  = 50383, testnet=true,  explorer path /tokyo   <- perps testnet, used here
 *   somniaTokyo    = 50321, testnet=false, production indexer
 * The bounty materials call the target "Somnia Tokyo testnet", which matches neither
 * name exactly. Reaching for `somniaTokyo` lands on a non-testnet chain that also has
 * a perpPoolFactory deployed. See feedback/03-tokyo-vs-hideki-naming.md
 */

import {
  SomniaMarkets,
  SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  fundingRate8h,
} from '@somnia-chain/markets-sdk'
import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains'
import { readFileSync } from 'node:fs'

const INDEXER_URL = 'https://hideki-dev.smk.somnia.host/v1/graphql'

/**
 * The SDK exports map has no "./package.json" entry, so the version cannot be
 * imported. Read it off disk instead, and never fail over a version string.
 * See feedback/05-sdk-package-json-not-exported.md
 */
function readSdkVersion() {
  try {
    const p = new URL('./node_modules/@somnia-chain/markets-sdk/package.json', import.meta.url)
    return JSON.parse(readFileSync(p, 'utf8')).version
  } catch {
    return 'unknown'
  }
}

/** Raw integer-string -> Number, scaled by the token decimals. */
function toNumber(raw, decimals) {
  if (raw === null || raw === undefined) return null
  return Number(raw) / 10 ** decimals
}

/** Price formatting with precision that follows magnitude, so sub-cent markets stay readable. */
function fmtPrice(raw, decimals) {
  const n = toNumber(raw, decimals)
  if (n === null) return '-'
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  if (abs >= 1000) return n.toFixed(2)
  if (abs >= 1) return n.toFixed(4)
  if (abs >= 0.0001) return n.toFixed(6)
  return n.toExponential(2)
}

/** Funding as a percentage per 8h window, the convention the SDK documents as primary. */
function fmtFunding8h(m) {
  if (m.fundingRate === null || m.fundingRate === undefined) return 'null'
  if (m.fundingWindowSec === null || m.fundingWindowSec === undefined) return 'no window'
  try {
    const per8h = fundingRate8h(BigInt(m.fundingRate), Number(m.fundingWindowSec))
    const pct = Number(per8h) / 1e16 // FUNDING_PRECISION is 1e18, so /1e16 gives percent
    return (pct >= 0 ? '+' : '') + pct.toFixed(4) + '%'
  } catch {
    return 'err'
  }
}

function pad(s, n, right = false) {
  s = String(s)
  if (s.length > n) s = s.slice(0, n - 1) + '~'
  return right ? s.padStart(n) : s.padEnd(n)
}

const account = process.argv[2]
const sdkVersion = readSdkVersion()

/**
 * wsRpcUrl is required for on-chain reads: the SDK reads the chain over WebSocket,
 * and listPerpMarkets() alone goes to the indexer, so the market table below works
 * without it while getPerpSystemConfig would not.
 *
 * Note that on-chain reads here fail intermittently with "rpc getBlock failed:
 * genesis check failed" whether this is passed or omitted.
 * See feedback/01-genesis-check-failed-intermittent.md
 */
const markets = new SomniaMarkets({
  chain: hidekiTestnet,
  indexerUrl: INDEXER_URL,
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  wsRpcUrl: hidekiTestnet.rpcUrls.default.webSocket?.[0],
})

console.log('dreamDEX perp markets - read-only inventory')
console.log('='.repeat(84))
console.log(`chain       ${hidekiTestnet.name} (${hidekiTestnet.id})  testnet=${hidekiTestnet.testnet}`)
console.log(`rpc         ${hidekiTestnet.rpcUrls.default.http[0]}`)
console.log(`explorer    ${hidekiTestnet.blockExplorers?.default?.url ?? '-'}`)
console.log(`indexer     ${INDEXER_URL}`)
console.log(`marginBank  ${SOMNIA_HIDEKI_TESTNET_ADDRESSES.marginBank}`)
console.log(`sdk         @somnia-chain/markets-sdk ${sdkVersion}`)
console.log(`read at     ${new Date().toISOString()}`)
console.log('')

let perps
try {
  perps = await markets.client.listPerpMarkets()
} catch (err) {
  // The docs describe the Hideki indexer as development-grade, and connect timeouts
  // to it do happen. Fail with something readable rather than a raw stack trace.
  console.error(`\nFailed to read the market list from the indexer.`)
  console.error(`  ${err?.shortMessage ?? err?.message ?? err}`)
  console.error(`  indexer: ${INDEXER_URL}`)
  console.error(`\nThis is usually transient. Try again.`)
  await markets.close().catch(() => {})
  process.exit(1)
}
perps.sort((a, b) => String(a.baseSymbol).localeCompare(String(b.baseSymbol)))

const cols = [
  ['MARKET', 16], ['LAST', 12, true], ['MARK', 12, true], ['FUND 8H', 11, true],
  ['TICK', 10, true], ['MIN QTY', 11, true], ['IM %', 6, true], ['TRADES', 9, true],
]
console.log(cols.map(([h, w, r]) => pad(h, w, r)).join(' '))
console.log(cols.map(([, w]) => '-'.repeat(w)).join(' '))

for (const m of perps) {
  console.log([
    pad(`${m.baseSymbol}-PERP`, 16),
    pad(fmtPrice(m.lastPrice, m.quoteDecimals), 12, true),
    pad(m.markPrice === null ? 'null' : fmtPrice(m.markPrice, m.quoteDecimals), 12, true),
    pad(fmtFunding8h(m), 11, true),
    pad(fmtPrice(m.tickSize, m.quoteDecimals), 10, true),
    pad(fmtPrice(m.minQuantity, m.baseDecimals), 11, true),
    pad(m.initialMarginBps === null ? 'null' : (m.initialMarginBps / 100).toFixed(2), 6, true),
    pad(m.tradeCount ?? '-', 9, true),
  ].join(' '))
}

console.log('')
console.log(`total perp markets: ${perps.length}`)

// --- Duplicate base symbols -------------------------------------------------
// listPerpMarkets() is keyed by pool address, not symbol. The documented lookup
// pattern, perps.find(m => m.baseSymbol === "BTC"), silently picks one of
// several when a symbol repeats. See feedback/04-duplicate-loadtest-markets.md
const bySymbol = new Map()
for (const m of perps) {
  const k = String(m.baseSymbol)
  bySymbol.set(k, (bySymbol.get(k) ?? []).concat(m.poolAddress))
}
const dupes = [...bySymbol.entries()].filter(([, pools]) => pools.length > 1)
if (dupes.length) {
  console.log('')
  console.log('duplicate baseSymbol values (symbol is NOT a unique market key)')
  console.log('-'.repeat(84))
  for (const [sym, pools] of dupes) {
    console.log(`${pad(sym, 14)} ${pools.length} markets`)
    for (const p of pools) console.log(`${' '.repeat(15)}${p}`)
  }
}

// --- Field coverage ---------------------------------------------------------
// Not an assertion of a bug: it reports which optional indexer fields are
// populated, which is how the items in feedback/ were found in the first place.
const watch = [
  'markPrice', 'indexPrice', 'fundingRate', 'cumulativeFundingPerUnit',
  'fundingUpdatedAt', 'fundingWindowSec', 'fundingIntervalSec', 'stopRegistry',
]
console.log('')
console.log('indexer field coverage')
console.log('-'.repeat(84))
for (const f of watch) {
  const missing = perps.filter((m) => m[f] === null || m[f] === undefined)
  let note = ''
  if (missing.length === perps.length) note = '  <- absent on every market'
  else if (missing.length) note = `  missing: ${missing.map((m) => m.baseSymbol).join(', ')}`
  console.log(`${pad(f, 26)} ${pad(`${perps.length - missing.length}/${perps.length}`, 8)}${note}`)
}

const wrongChain = perps.filter((m) => m.chainId !== hidekiTestnet.id)
if (wrongChain.length) {
  console.log(`\nWARNING: ${wrongChain.length} market(s) report a chainId other than ${hidekiTestnet.id}`)
}

// --- System config cross-check ----------------------------------------------
// The docs call getPerpSystemConfig "the check worth running before trusting any
// list", and warn that SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral is NOT the perps
// collateral. This verifies that on-chain rather than taking it on faith.
const primaryBank = SOMNIA_HIDEKI_TESTNET_ADDRESSES.marginBank
console.log('')
console.log(`perp system config for marginBank ${primaryBank}`)
console.log('-'.repeat(84))
try {
  const cfg = await markets.client.getPerpSystemConfig(primaryBank)
  for (const [k, v] of Object.entries(cfg)) console.log(`${pad(k, 26)} ${v}`)

  const quoteTokens = [...new Set(perps.map((m) => String(m.quoteToken).toLowerCase()))]
  const sdkCollateral = String(SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral).toLowerCase()
  console.log('')
  console.log(`market quoteToken(s):      ${quoteTokens.join(', ')}`)
  console.log(`addresses.collateral:      ${sdkCollateral}`)
  console.log(
    quoteTokens.includes(sdkCollateral)
      ? 'addresses.collateral matches the market quote token.'
      : 'addresses.collateral is a DIFFERENT token from the perps quote token, as the docs warn.',
  )
} catch (err) {
  console.log(`read failed: ${err?.shortMessage ?? err?.message ?? err}`)
}

// --- Optional: voucher eligibility (read-only) ------------------------------
if (account) {
  console.log('')
  console.log(`perp voucher eligibility for ${account}`)
  console.log('-'.repeat(84))
  const banks = [...new Set(perps.map((m) => m.marginBank).filter(Boolean))]
  for (const bank of banks) {
    try {
      const e = await markets.client.getPerpVoucherEligibility(bank, account)
      console.log(`marginBank ${bank}`)
      for (const [k, v] of Object.entries(e)) {
        console.log(`  ${pad(k, 24)} ${typeof v === 'bigint' ? v.toString() : v}`)
      }
    } catch (err) {
      console.log(`${bank}  read failed: ${err?.shortMessage ?? err?.message ?? err}`)
    }
  }
}

/**
 * Release the client. Once wsRpcUrl is set the SDK holds a WebSocket open, so without
 * this the event loop never drains and the process hangs after printing everything.
 * The SDK's own tutorials end the same way.
 */
await markets.close()
