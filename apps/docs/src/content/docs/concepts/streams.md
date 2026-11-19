---
title: Streams
description: How a payment stream accrues per second, and what withdrawing, cancelling, topping up and extending do to it.
---

A stream pays a recipient continuously, per second, from funds the sender
locks up front. There is no per-second state on chain: the contract stores the
rate and the span, and computes what has accrued from the ledger timestamp
whenever it is read.

Each deployed stream contract holds exactly one stream. `create` claims the
instance permanently; deploy a fresh instance for every stream.

## The record

| Field | Meaning |
| --- | --- |
| `ratePerSecond` | Stroops released to the recipient each second. |
| `start`, `stop` | Ledger timestamps (seconds) the stream runs between. |
| `deposited` | Everything the sender has put in: `ratePerSecond × (stop − start)` at creation, plus any top-ups and extensions. |
| `withdrawn` | What the recipient has taken out so far. |
| `refunded` | What went back to the sender on cancellation. |
| `cancellable` | Whether the sender may cancel. Fixed at creation. |
| `cancelledAt` | Ledger timestamp of the cancellation, or `null`. |

## Accrual

Nothing accrues before `start`. From `start` until `stop`, the recipient's
share grows by `ratePerSecond` every second; after `stop` it stops growing.

```
accrued   = ratePerSecond × (min(now, stop) − start)     for now ≥ start
available = accrued − withdrawn
```

**Example.** A stream of 100 stroops per second from `start = 1_000` to
`stop = 1_060` locks `100 × 60 = 6_000` stroops at creation.

| Ledger time | Accrued | Withdrawn | Available to the recipient |
| --- | --- | --- | --- |
| 990 | 0 | 0 | 0 |
| 1_012 | 1_200 | 0 | 1_200 |
| 1_012, after a full withdrawal | 1_200 | 1_200 | 0 |
| 1_030 | 3_000 | 1_200 | 1_800 |
| 1_100 (past `stop`) | 6_000 | 1_200 | 4_800 |

Because accrual depends on the time of the read, the amount a withdrawal
actually takes is at least what a read moments earlier showed, never less.
Read it with `balanceOf(recipient)`, a free simulation that sends nothing:

```ts
const available = await stream.balanceOf(recipient);
console.log("recipient can withdraw", fromStroops(available));
```

Only the recipient can withdraw. Omit the amount to take everything
available:

```ts
const withdraw = await asRecipient.withdraw();
const withdrawn = await withdraw.signAndSend(recipientSigner);
console.log("withdrew", fromStroops(withdrawn.result), "in", withdrawn.hash);
```

The contract conserves funds at every point:
`withdrawn + refunded + remaining() === deposited`.

## Cancellation

A sender can cancel only a stream created with `cancellable: true`, and only
once. Cancelling settles the stream at that moment:

1. Everything accrued and not yet withdrawn is paid to the recipient.
2. The unaccrued remainder goes back to the sender and is recorded as
   `refunded`.
3. `cancelledAt` is set. A cancelled stream cannot be withdrawn from, topped
   up, extended or cancelled again; to keep paying, create a new stream.

**Example.** Cancelling the stream above at ledger time 1_030, after the
recipient withdrew 1_200: accrued is 3_000, so the remaining 1_800 is paid to
the recipient and `6_000 − 3_000 = 3_000` is refunded to the sender.

```ts
await (await stream.cancel()).signAndSend(signer);
```

## Top-up

`topUp(amount)` adds funds and moves `stop` later by the span they buy at the
current rate: `stop += amount / ratePerSecond`. The amount must be an exact
multiple of `ratePerSecond`, because a fraction of a second cannot be
represented; the contract rejects anything else rather than strand the
remainder.

**Example.** Topping up the 100 stroops/second stream by 1_500 stroops adds
15 seconds: `stop` goes from 1_060 to 1_075 and `deposited` from 6_000 to
7_500. A top-up of 1_550 is rejected.

```ts
await (await stream.topUp(1_500n)).signAndSend(signer);
```

## Extend

`extend(newStop)` moves `stop` to a later timestamp and pulls the funds the
longer span needs from the sender: `ratePerSecond × (newStop − stop)`. The new
stop must be later than the current one.

**Example.** Extending the original stream from `stop = 1_060` to
`newStop = 1_120` pulls `100 × 60 = 6_000` more stroops, so `deposited`
becomes 12_000.

```ts
await (await stream.extend(1_120n)).signAndSend(signer);
```

Top-up and extend reach the same place from different directions: top-up
says how much to add, extend says when it should end.

## Creating a stream

`create` pulls `ratePerSecond × (stop − start)` from the sender immediately.
The recipient does not need an account yet to be named on the stream, only to
withdraw from it. Simulate before signing; a failing simulation means the real
call would fail, before anyone signs or pays a fee:

```ts
const create = await stream.create({
  sender: signer.publicKey,
  recipient,
  token: NATIVE_TOKEN,
  ratePerSecond,
  start,
  stop,
  cancellable: true,
});

await create.simulate();
const created = await create.signAndSend(signer);
```

## Where the snippets come from

Every snippet on this page is taken from
[`packages/sdk/examples/stream-lifecycle.ts`](https://github.com/Sororail/sororail-frontend/blob/main/packages/sdk/examples/stream-lifecycle.ts)
or uses the same `StreamClient` methods. That example is type-checked in CI
against the current client API (`pnpm --filter @sororail/sdk typecheck:examples`)
and runs against a live testnet deployment on the scheduled integration job, so
a renamed or removed method fails there rather than going stale here. See
[Amounts](../amounts/) for how stroops relate to the token amounts users see.
