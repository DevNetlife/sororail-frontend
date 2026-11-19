---
title: Troubleshooting
description: Fix the common Freighter and network problems that block a payment, including wrong network, locked wallet, no XLM, unfunded account and stale cache.
---

Most first-run failures come from the wallet rather than the SDK. Check these
in order: each section lists the symptom, the cause and the fix.

## Wrong network

**Symptoms.** The transaction is rejected, or the account shows a balance you
do not expect. The app is talking to testnet while Freighter is on mainnet, or
the other way round.

**Cause.** The network Freighter is set to differs from the `networkPassphrase`
and `rpcUrl` your client uses.

**Fix.** Switch Freighter to the same network as your client. For testnet, pass
`Networks.TESTNET` as the passphrase and use the testnet RPC URL. Reload the page
after switching.

## Locked wallet

**Symptoms.** Signing does nothing, or Freighter asks for your password. The
SDK reports a `SigningError`.

**Cause.** Freighter locks itself after a period of inactivity.

**Fix.** Unlock Freighter with your password and retry the action. In your app,
catch `SigningError` and ask the user to unlock their wallet.

## No XLM

**Symptoms.** The transaction fails because the account cannot pay the fee, or
the operation is rejected for insufficient balance.

**Cause.** Every transaction costs a small fee in XLM, and an account must hold
the network's minimum balance.

**Fix.** Send XLM to the account. On testnet you can fund it for free with
Friendbot: `https://friendbot.stellar.org/?addr=<PUBLIC_KEY>`, replacing
`<PUBLIC_KEY>` with the account's public key.

## Unfunded account

**Symptoms.** The client reports that the account was not found, even though
the address is correct.

**Cause.** A Stellar account does not exist on the ledger until it receives its
first XLM. Until then, nothing can be read from it or signed for it.

**Fix.** Fund the account with a first payment of XLM. On testnet, use Friendbot
as described above.

## Stale cache

**Symptoms.** A balance or stream state does not update after a transaction, or
the wallet still shows the previous account after you switch accounts.

**Cause.** The browser keeps the account Freighter last reported, and your app
may keep reads from an earlier ledger.

**Fix.** Switch accounts in Freighter, then reload the page. Re-read state
instead of reusing old values: `balanceOf` simulates against the latest ledger.
If the problem continues, clear site data for your local development host only.

## Still stuck?

Open an issue on the
[SoroRail repository](https://github.com/Sororail/sororail-frontend/issues) with
the network you use, the step that fails and the error message. Do not include
secret keys.
