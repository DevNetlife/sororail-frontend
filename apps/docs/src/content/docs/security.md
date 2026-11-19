---
title: Security and trust assumptions
description: What SoroRail does and does not guarantee, and how to report a problem.
---

SoroRail is **unaudited and testnet only**. Do not deploy the contracts to mainnet or use them to hold real value. This page explains what the software assumes and where its guarantees stop. The full reporting policy is in [SECURITY.md](https://github.com/Sororail/sororail-frontend/blob/main/SECURITY.md) in this repository, and the contracts repository has its own [SECURITY.md](https://github.com/Sororail/sororail-contracts/blob/main/SECURITY.md).

## Audit status

No external audit has been completed. No mainnet contract addresses are published. The reference app shows an unaudited warning for this reason.

## Token assumptions

- Amounts are `bigint` in base units. The SDK never converts them to `number`.
- The contracts move whichever Stellar Asset Contract address you pass to them. They do not check that the token is what its name says, so only use tokens you have verified.
- Native XLM is represented by its Stellar Asset Contract on testnet. The reference app reads this from `NEXT_PUBLIC_TOKEN_ID`.

## Key handling

- The SDK never holds or requests a secret key. Signing is injected through a signer you provide.
- The reference app does all signing client-side through the wallet. No secret key is sent to a server.
- Keep private keys out of environment variables that Next.js inlines. Only `NEXT_PUBLIC_*` values reach the browser, and they are public by design.

## Configuration

Environment variables are checked when the app builds. An invalid RPC URL, token ID or contract address stops the build with a message that names the variable. See `apps/web/.env.example` for the accepted values.

## Responsible disclosure

Do not open a public issue for a security problem. Use GitHub's private vulnerability reporting on the affected repository (Security → Report a vulnerability). Include the affected contract and commit, the impact, and the smallest reproduction you have.
