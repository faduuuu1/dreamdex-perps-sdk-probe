# Docs pin the SDK at 0.32.1 as "the one the app runs", but npm installs 0.33.0
Severity: normal
Area: docs

## Steps to reproduce

1. Read *Perps on Testnet for Developers*. Its opening paragraph says to build with
   `@somnia-chain/markets-sdk`, and that the page uses version 0.32.1, the one the
   app runs.
2. Follow it the obvious way:

   ```bash
   npm install @somnia-chain/markets-sdk
   ```

3. Check what landed.

## Expected

Either the install instruction pins the version the page documents, or the page says
which version range is safe, so a builder knows whether they are on the same code as
the app.

## Actual

A plain install resolves `latest`, which is **0.33.0** — a minor version ahead of the
0.32.1 the page documents and ahead of what the page says the app runs. Nothing warns
about the gap. Both versions are published, so pinning is possible; the docs simply
do not ask for it.

This matters for the Feedback track in particular. A reporter following the docs is
on 0.33.0 while the app is on 0.32.1, so a difference in behaviour between a script
and the app may be a version difference rather than a bug, in either direction. Any
report that does not state its version is ambiguous, and the one way to state it
reliably is itself unavailable (see
[05-sdk-package-json-not-exported.md](05-sdk-package-json-not-exported.md)).

Suggested fix: give the install command with the version pinned, for example
`npm install @somnia-chain/markets-sdk@0.32.1`, and note what changed in 0.33.0 if
builders should prefer it. Keeping the page's stated version in step with `latest`
would work too.

## Evidence

Published dist-tags:

```json
{
  "latest": "0.33.0",
  "next-0.32": "0.32.1-rc.1791818930433",
  "next-0.31": "0.31.1-rc.1791533467513",
  "rc": "0.32.0-rc.1791380050012",
  "canary": "0.32.2-canary.42234160381.g04c4cef7358c"
}
```

Stable releases, most recent last:

```
... 0.30.0  0.31.0  0.32.0  0.32.1  0.33.0
```

So `0.32.1` exists as a plain release and could be pinned, while `npm install` with
no version gets `0.33.0`:

```
$ npm install @somnia-chain/markets-sdk
$ node -e "..."   # reading the version off disk
0.33.0
```

The documented sentence, for reference:

> Build against it with @somnia-chain/markets-sdk; this page uses version 0.32.1,
> the one the app runs.

Everything else in this repo was tested on 0.33.0, which is what the documented
install command produces.

## Environment

- SDK version: 0.33.0 installed, 0.32.1 documented
- Network: not network-dependent
- Node.js 24.19.0 on Windows 10, npm
- Wallet address: not applicable
