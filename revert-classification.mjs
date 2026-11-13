import * as SDK from '@somnia-chain/markets-sdk'
const names = Object.keys(SDK)
console.log('isRevert exported from package root       :', names.includes('isRevert'))
console.log('isMissingContractView exported from root  :', names.includes('isMissingContractView'))
console.log('decodeRevert exported from package root   :', names.includes('decodeRevert'))
console.log('toSdkError exported from package root     :', names.includes('toSdkError'))
console.log('')
// What a transport failure becomes when passed to the only exported helper.
const timeout = Object.assign(new Error('fetch failed'), { code: 'UND_ERR_CONNECT_TIMEOUT' })
const e = SDK.decodeRevert(timeout, { address: '0xabc', functionName: 'getPerpSystemConfig' })
console.log('decodeRevert(a connect timeout):')
console.log('  constructor :', e.constructor.name)
console.log('  errorName   :', e.errorName)
console.log('  reason      :', e.reason)
console.log('  data        :', e.data)
console.log('  message     :', String(e.message).slice(0, 110))
console.log('  cause code  :', e.cause?.code)

console.log('')
console.log('--- the same for other transport failures ---')
for (const [label, err] of [
  ['connect timeout', Object.assign(new Error('fetch failed'), { code: 'UND_ERR_CONNECT_TIMEOUT' })],
  ['socket hang up', Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })],
  ['dns failure', Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })],
  ['http 429', Object.assign(new Error('Too Many Requests'), { status: 429 })],
]) {
  const d = SDK.decodeRevert(err, { functionName: 'getPerpSystemConfig' })
  console.log(`  ${label.padEnd(16)} -> ${d.constructor.name}, errorName=${d.errorName}, message="${String(d.message).slice(0, 62)}"`)
}
