---
"@sororail/sdk": minor
---

Read-only client methods (`get`, `state`, `claimable` and the other simulated
reads) now work without a `publicKey`. They simulate from the all-zero account
instead of throwing a `ValidationError`, so an app can show a position before a
wallet is connected. Calls that build a transaction to sign still require a
`publicKey` and still reject without one.
