# The SDK version cannot be read programmatically, although every bug report is asked to state it
Severity: normal
Area: SDK

## Steps to reproduce

1. Try to read the installed SDK version the ordinary way:

   ```js
   import { createRequire } from 'node:module'
   const version = createRequire(import.meta.url)('@somnia-chain/markets-sdk/package.json').version
   ```

2. Run it.

## Expected

The version string, as with most packages. `./package.json` is conventionally left
reachable in an `exports` map precisely so tools, bug reports and diagnostics can
read it. Failing that, the SDK exports a version constant.

## Actual

It throws:

```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './package.json' is not
defined by "exports" in .../node_modules/@somnia-chain/markets-sdk/package.json
```

The `exports` map has entries for `.`, `./react`, `./chains`, `./reactivity` and
`./native`, and no `./package.json`. There is also no exported version constant: no
`VERSION`, `SDK_VERSION` or similar appears among the package's named exports.

So a script cannot state the SDK version it is running, which is awkward given the
bounty's own report template asks for "SDK version" under Environment, and any bot
logging its environment at startup needs it. The workaround is to read the file off
disk and guess at the layout:

```js
const p = new URL('./node_modules/@somnia-chain/markets-sdk/package.json', import.meta.url)
const version = JSON.parse(readFileSync(p, 'utf8')).version
```

That breaks under pnpm, Yarn PnP, a hoisted monorepo, or any bundle, so it is not a
real fix. `list-perp-markets.mjs` in this repo uses it with a try/catch and falls back
to printing `unknown`.

Suggested fix: add `"./package.json": "./package.json"` to the `exports` map. It is a
one-line change and the usual convention. Exporting a `VERSION` constant would also
work and is more robust for bundled consumers.

## Evidence

The `exports` map as published in 0.33.0:

```json
{
  ".":            { "types": "./dist/index.d.ts",              "default": "./dist/index.js" },
  "./react":      { "types": "./dist/react.d.ts",              "default": "./dist/react.js" },
  "./chains":     { "types": "./dist/chains/index.d.ts",       "default": "./dist/chains/index.js" },
  "./reactivity": { "types": "./dist/reactivity/index.d.ts",   "default": "./dist/reactivity/index.js" },
  "./native":     { "types": "./dist/native/index.d.ts",       "default": "./dist/native/index.js" }
}
```

The thrown error is quoted above, reproduced on a clean install.

## Environment

- SDK version: `@somnia-chain/markets-sdk` 0.33.0 (read off disk, since that is the
  only way)
- Network: not network-dependent; reproduces offline
- Node.js 24.19.0 on Windows 10, npm install, standard `node_modules` layout
- Wallet address: not applicable, no chain access involved
