---
title: Recurring
description: Pull-based subscriptions — authorize, charge, cancel, the token allowance that caps payments, and why skipped periods are forfeited.
---

The recurring contract lets a payee pull a fixed amount from a payer once per
period. It is **pull-based authorization**: the payer records the terms, and the
payee charges when each period is due.

**The contract never holds funds.** Each charge moves money directly from payer
to payee with `transfer_from`, so there is no balance to withdraw and no custody
risk in the contract itself.

## How a subscription is set up

A subscription needs two steps from the payer, and both are required:

1. **Authorize** the terms on the recurring contract (`authorize`): the payee,
   token, amount per period, period length and an optional cap on charges.
2. **Approve** the recurring contract as a spender on the token, for at least the
   total the payer intends to allow.

Step 1 alone does not let the payee take anything. The token allowance from
step 2 is the real cap: when it runs out, charges fail, whatever the
authorization says.

```ts
// 1. The payer records the terms
await (await recurring.authorize({
  payer,
  payee,
  token,
  amountPerPeriod: 500n,
  periodSeconds: 30n * 24n * 60n * 60n, // monthly
  maxPeriods: 12,                       // omit for open-ended
})).signAndSend(payerSigner);

// 2. The payer approves the contract on the token, covering the total
//    (12 periods x 500 = 6000). Use the token contract's approve method.
```

The first charge becomes available one full period after `authorize`.

## Charging

The payee calls `charge` once each period. It pulls one period's amount and
returns it:

```ts
const amount = await (await recurring.charge()).signAndSend(payeeSigner);
```

Check before charging when you need to know whether a charge would succeed:

| Method | Returns |
| --- | --- |
| `isChargeable()` | Whether a charge would succeed right now. |
| `nextChargeableAt()` | The earliest time the next charge may be taken. |
| `remainingPeriods()` | Charges left under the cap, or `null` if open-ended. |
| `get()` | The full authorization record. |

`nextChargeableAt()` reports the stored schedule even after cancellation or
exhaustion. Use `isChargeable()` for whether a charge would actually succeed.

## Cancelling

```ts
await (await recurring.cancel()).signAndSend(signer);
```

Either party can cancel, and it takes effect immediately. The payer can also stop
charges at any time by revoking the token allowance, with or without calling
`cancel`.

## Skipped periods are forfeited

The next charge is scheduled at `now + periodSeconds` each time a charge
happens. A payee who waits three months cannot then take three payments at once.
Missed periods are lost, not banked.

This is a deliberate consumer-protection choice, and it often surprises
merchants. Any interface built on this contract should say so to the payee before
they set up or rely on a subscription.

## Next steps

- [Batch payout](/sororail-frontend/concepts/batch-payout/) for paying many
  recipients in one transaction.
- [Amounts](/sororail-frontend/concepts/amounts/) for how token amounts are
  represented as `bigint` values.
