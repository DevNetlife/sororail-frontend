import type { Grant, Stream } from "../types/index.js";

/**
 * Calculates the accrued amount for a stream at a given timestamp.
 *
 * Mirrors the contract's accrual logic: amount grows linearly between start
 * and stop (or cancellation), capped at what was deposited minus what was
 * already withdrawn or refunded.
 *
 * @param stream The stream record
 * @param ts Current timestamp in seconds
 * @returns The amount accrued but not yet withdrawn
 */
export function accruedAt(stream: Stream, ts: bigint): bigint {
  const effectiveEnd = stream.cancelledAt ?? stream.stop;
  
  if (ts < stream.start) {
    return 0n;
  }

  const elapsed = ts >= effectiveEnd
    ? effectiveEnd - stream.start
    : ts - stream.start;

  const totalAccrued = elapsed * stream.ratePerSecond;
  const available = stream.deposited - stream.withdrawn - stream.refunded;

  return totalAccrued < available ? totalAccrued : available;
}

/**
 * Calculates the vested amount for a grant at a given timestamp.
 *
 * Mirrors the contract's vesting logic: nothing vests before the cliff, then
 * amount grows linearly from cliff to full duration. Caps at total minus
 * already claimed or returned.
 *
 * @param grant The grant record
 * @param ts Current timestamp in seconds
 * @returns The amount vested but not yet claimed
 */
export function vestedAt(grant: Grant, ts: bigint): bigint {
  const effectiveEnd = grant.revokedAt ?? grant.start + grant.duration;

  if (ts < grant.start + grant.cliff) {
    return 0n;
  }

  const vestingEnd = grant.revokedAt !== null
    ? (grant.revokedAt < grant.start + grant.duration ? grant.revokedAt : grant.start + grant.duration)
    : grant.start + grant.duration;

  if (ts >= vestingEnd) {
    const maxVested = grant.total - grant.claimed - grant.returned;
    return maxVested > 0n ? maxVested : 0n;
  }

  const vestingDuration = grant.duration - grant.cliff;
  if (vestingDuration === 0n) {
    return 0n;
  }

  const elapsedSinceCliff = ts - (grant.start + grant.cliff);
  const vestedFraction = elapsedSinceCliff * grant.total / vestingDuration;
  const available = grant.total - grant.claimed - grant.returned;

  return vestedFraction < available ? vestedFraction : available;
}
