import {
  normalizeFundingRate, fundingRate8h, fundingRate1h, fundingRatePerInterval,
  annualizedFundingRate, intervalsPerWindow, FUNDING_PRECISION, EIGHT_HOURS_SEC,
} from '@somnia-chain/markets-sdk'

const R = 1_000_000_000_000_000n // 1e15 = 0.1% per window

function run(label, fn) {
  try {
    const v = fn()
    console.log(`${label.padEnd(56)} => ${typeof v === 'bigint' ? v.toString() + 'n' : String(v)}`)
  } catch (e) {
    console.log(`${label.padEnd(56)} => THROWS ${e.constructor.name}: ${String(e.message).slice(0, 80)}`)
  }
}

console.log('--- documented identity: 8h is a no-op at a 28800 window ---')
run('fundingRate8h(1e15, 28800)', () => fundingRate8h(R, EIGHT_HOURS_SEC))
run('normalizeFundingRate(1e15, 28800, 28800)', () => normalizeFundingRate(R, 28800, 28800))

console.log('\n--- documented: truncates toward zero, sign preserved ---')
run('normalizeFundingRate(7, 28800, 3600)   [7/8 -> 0]', () => normalizeFundingRate(7n, 28800, 3600))
run('normalizeFundingRate(-7, 28800, 3600)  [-7/8 -> 0]', () => normalizeFundingRate(-7n, 28800, 3600))
run('fundingRate1h(1e15, 28800)', () => fundingRate1h(R, 28800))
run('fundingRate1h(-1e15, 28800)', () => fundingRate1h(-R, 28800))

console.log('\n--- zero / missing window (my item 04 saw null windows on a live pool) ---')
run('fundingRate8h(1e15, 0)', () => fundingRate8h(R, 0))
run('normalizeFundingRate(1e15, 0, 3600)', () => normalizeFundingRate(R, 0, 3600))
run('fundingRate1h(1e15, 0)', () => fundingRate1h(R, 0))
run('annualizedFundingRate(1e15, 0)', () => annualizedFundingRate(R, 0))

console.log('\n--- NaN / undefined window (what a null field coerces to) ---')
run('fundingRate8h(1e15, NaN)', () => fundingRate8h(R, NaN))
run('fundingRate8h(1e15, undefined)', () => fundingRate8h(R, undefined))
run('normalizeFundingRate(1e15, NaN, 3600)', () => normalizeFundingRate(R, NaN, 3600))

console.log('\n--- negative / fractional window ---')
run('fundingRate8h(1e15, -28800)', () => fundingRate8h(R, -28800))
run('normalizeFundingRate(1e15, 28800.5, 3600)', () => normalizeFundingRate(R, 28800.5, 3600))
run('normalizeFundingRate(1e15, 28800, 3600.5)', () => normalizeFundingRate(R, 28800, 3600.5))

console.log('\n--- per-interval and intervalsPerWindow ---')
run('fundingRatePerInterval(1e15, 28800, 3600)', () => fundingRatePerInterval(R, 28800, 3600))
run('fundingRatePerInterval(1e15, 28800, 0)', () => fundingRatePerInterval(R, 28800, 0))
run('intervalsPerWindow(28800, 3600)   [doc says 8]', () => intervalsPerWindow(28800, 3600))
run('intervalsPerWindow(28800, 0)', () => intervalsPerWindow(28800, 0))
run('intervalsPerWindow(28800, 7000)   [non-integer]', () => intervalsPerWindow(28800, 7000))
run('intervalsPerWindow(0, 3600)', () => intervalsPerWindow(0, 3600))

console.log('\n--- annualized ---')
run('annualizedFundingRate(1e15, 28800)  [~1095x]', () => annualizedFundingRate(R, 28800))
run('annualizedFundingRate(-1e15, 28800)', () => annualizedFundingRate(-R, 28800))

console.log('\n--- the asymmetry, side by side ---')
run('normalizeFundingRate(1e15, 0, 3600)      window=0', () => normalizeFundingRate(R, 0, 3600))
run('normalizeFundingRate(1e15, 28800, 0)     target=0', () => normalizeFundingRate(R, 28800, 0))
run('normalizeFundingRate(1e15, 28800, null)  target=null', () => normalizeFundingRate(R, 28800, null))
run('normalizeFundingRate(1e15, 28800, -3600) target<0', () => normalizeFundingRate(R, 28800, -3600))
run('intervalsPerWindow(28800, 0)             same arg', () => intervalsPerWindow(28800, 0))
const shortRate = -2_500_000_000_000_000n
run('fundingRatePerInterval(-2.5e15, 28800, 3600)  ok', () => fundingRatePerInterval(shortRate, 28800, 3600))
run('fundingRatePerInterval(-2.5e15, 28800, 0)     zero', () => fundingRatePerInterval(shortRate, 28800, 0))
run('fundingRatePerInterval(-2.5e15, 28800, null)  zero', () => fundingRatePerInterval(shortRate, 28800, null))
run('fundingRatePerInterval(-2.5e15, 28800, -3600) flip', () => fundingRatePerInterval(shortRate, 28800, -3600))

console.log('\n--- the same argument in two more helpers ---')
{
  const { isFundingStale, densifyFundingBuckets } = await import('@somnia-chain/markets-sdk')
  const now = 1762000000n
  for (const i of [3600, 0, -3600, null]) {
    run(`isFundingStale(fresh 10s ago, interval=${i})`, () => isFundingStale(now - 10n, i, now))
  }
  const rows = [{ bucketStart: '1761996400', intervalSeconds: 3600, avgFundingRate8h: '5', coverage: '1' }]
  for (const i of [0, -3600]) {
    run(`densifyFundingBuckets(rows, intervalSeconds=${i})`, () => densifyFundingBuckets(rows, i, 1761989200, 1762010800).length)
  }
}
