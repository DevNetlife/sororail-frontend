import { ValidationError } from "../errors/index.js";

/**
 * Split an amount by basis points with identical rounding to common::math::split_bps.
 *
 * Returns `[high, low]` where `high` is the BPS share and `low` is the remainder.
 * Halves always sum to exactly the original amount.
 *
 * @param amount - The total amount to split (in stroops)
 * @param bps - Basis points (0-10,000, where 10,000 = 100%)
 * @throws {ValidationError} When bps is above 10,000
 *
 * @example
 * ```ts
 * const [fee, remainder] = splitBps(1000n, 250); // 2.5% fee
 * // fee = 25n, remainder = 975n
 * ```
 */
export function splitBps(amount: bigint, bps: number): [bigint, bigint] {
  if (bps > 10_000) {
    throw new ValidationError(
      `Basis points must not exceed 10,000 (100%), got ${bps}`,
    );
  }

  const high = (amount * BigInt(bps)) / 10_000n;
  const low = amount - high;

  return [high, low];
}
