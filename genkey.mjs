import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { existsSync, readFileSync, appendFileSync } from 'node:fs'

if (existsSync('.env') && /PRIVATE_KEY=/.test(readFileSync('.env', 'utf8'))) {
  console.log('.env already contains a PRIVATE_KEY — not overwriting.')
  process.exit(0)
}

const pk = generatePrivateKey()
const address = privateKeyToAccount(pk).address

appendFileSync('.env', `PRIVATE_KEY=${pk}\n`)

console.log('Keypair generated.')
console.log('Private key written to .env (not printed here).')
console.log('')
console.log('BOT ADDRESS: ' + address)
console.log('')
console.log('Paste that address into dreamDEX > Link a bot. Never paste the private key anywhere.')
