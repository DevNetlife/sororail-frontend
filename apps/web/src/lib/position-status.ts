/**
 * Lifecycle buckets for the streams and vesting lists (#428). A position is `cancelled` once it has been stopped early
 * (stream cancelled, grant revoked), `ended` once its schedule has run out, and `active` otherwise.
 */
export type PositionStatus = "active" | "ended" | "cancelled";

export const POSITION_STATUSES: readonly PositionStatus[] = ["active", "ended", "cancelled"];

export const STATUS_LABEL: Record<PositionStatus, string> = {
  active: "Active",
  ended: "Ended",
  cancelled: "Cancelled",
};

export function streamStatus(
  stream: { stop: bigint; cancelledAt?: bigint | null | undefined },
  now: bigint,
): PositionStatus {
  if (stream.cancelledAt) return "cancelled";
  return now >= stream.stop ? "ended" : "active";
}

/** `cliff` and `duration` are spans from `start`, as on the contract. */
export function grantStatus(
  grant: { start: bigint; duration: bigint; revokedAt?: bigint | null | undefined },
  now: bigint,
): PositionStatus {
  if (grant.revokedAt) return "cancelled";
  return now >= grant.start + grant.duration ? "ended" : "active";
}

/** Counts per bucket, from the statuses the cards have reported so far. */
export function countByStatus(
  statuses: Readonly<Record<string, PositionStatus>>,
): Record<PositionStatus, number> {
  const counts: Record<PositionStatus, number> = { active: 0, ended: 0, cancelled: 0 };
  for (const status of Object.values(statuses)) counts[status] += 1;
  return counts;
}

/**
 * A card whose status is not known yet (still loading, wallet not connected, other network) stays visible under
 * Active, so the default view never hides something the user has not been able to see yet.
 */
export function isVisible(status: PositionStatus | undefined, filter: PositionStatus): boolean {
  if (status === undefined) return filter === "active";
  return status === filter;
}
