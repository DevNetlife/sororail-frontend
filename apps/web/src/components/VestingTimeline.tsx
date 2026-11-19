"use client";

interface VestingTimelineProps {
  /** Stream start timestamp (seconds). */
  start: bigint;
  /** Cliff duration in seconds (span from start, not a timestamp). */
  cliff: bigint;
  /** Total vesting duration in seconds (span from start). */
  duration: bigint;
  /** Current ledger time (seconds). */
  now: bigint;
  /** Revocation timestamp, if the grant was revoked. */
  revokedAt?: bigint | null;
}

function clamp(v: bigint, lo: bigint, hi: bigint): bigint {
  return v < lo ? lo : v > hi ? hi : v;
}

function pctNum(num: bigint, den: bigint): number {
  if (den === 0n) return 0;
  return Math.min(100, Math.max(0, Number((num * 10000n) / den) / 100));
}

function daysLabel(seconds: bigint): string {
  const d = Number(seconds) / 86400;
  return d < 1 ? `${Math.round(Number(seconds) / 3600)}h` : `${Math.round(d)}d`;
}

const SVG_W = 300;
const SVG_H = 24;

/**
 * Two-phase vesting timeline that calls out the cliff explicitly.
 *
 * Phase 1 (cliff period): start → cliff, shown with a crosshatch pattern —
 * nothing vests here.
 * Phase 2 (vesting period): cliff → end, filled proportionally to progress.
 */
export function VestingTimeline({
  start,
  cliff,
  duration,
  now,
  revokedAt,
}: VestingTimelineProps) {
  if (duration === 0n) return null;

  const cliffAt = start + cliff;
  const endAt = start + duration;
  const vestingDuration = duration - cliff;

  const cliffPct = pctNum(cliff, duration);
  const cliffX = (cliffPct / 100) * SVG_W;

  const beforeCliff = now < cliffAt;

  const vestingElapsed =
    now <= cliffAt
      ? 0n
      : clamp(now, cliffAt, endAt) - cliffAt;

  const vestedPct =
    vestingDuration > 0n ? pctNum(vestingElapsed, vestingDuration) : 0;

  const vestedBarW = ((vestedPct / 100) * (SVG_W - cliffX));

  // If revoked, mark that point in the vesting phase.
  const revokedX =
    revokedAt && revokedAt > cliffAt && revokedAt <= endAt
      ? cliffX + pctNum(revokedAt - cliffAt, vestingDuration) / 100 * (SVG_W - cliffX)
      : null;

  const patternId = "vt-hatch";

  return (
    <div>
      <div className="label" style={{ marginBottom: "0.25rem" }}>
        Vesting timeline
      </div>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        height={SVG_H}
        style={{ display: "block" }}
        role="img"
        aria-label={
          beforeCliff
            ? "Before cliff — nothing has vested yet"
            : `${vestedPct.toFixed(1)}% vested`
        }
      >
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform="rotate(45)"
          >
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={6}
              stroke="var(--border-strong)"
              strokeWidth={2}
            />
          </pattern>
        </defs>

        {/* Background track */}
        <rect x={0} y={0} width={SVG_W} height={SVG_H} rx={3} fill="var(--surface-sunken)" />

        {/* Cliff phase: hatched to signal tokens are locked */}
        {cliff > 0n && (
          <rect
            x={0}
            y={0}
            width={cliffX}
            height={SVG_H}
            rx={3}
            fill={`url(#${patternId})`}
            opacity={0.5}
          />
        )}

        {/* Vesting phase: progress fill */}
        {!beforeCliff && vestedBarW > 0 && (
          <rect
            x={cliffX}
            y={0}
            width={vestedBarW}
            height={SVG_H}
            fill="var(--incoming)"
            opacity={0.75}
          />
        )}

        {/* Cliff boundary */}
        {cliff > 0n && cliff < duration && (
          <line
            x1={cliffX}
            y1={0}
            x2={cliffX}
            y2={SVG_H}
            stroke="var(--text)"
            strokeWidth={1.5}
            opacity={0.45}
          />
        )}

        {/* Revocation marker */}
        {revokedX !== null && (
          <line
            x1={revokedX}
            y1={0}
            x2={revokedX}
            y2={SVG_H}
            stroke="var(--danger)"
            strokeWidth={2}
          />
        )}

        {/* Now marker within vesting phase */}
        {!beforeCliff && now < endAt && (
          <line
            x1={cliffX + (vestedPct / 100) * (SVG_W - cliffX)}
            y1={0}
            x2={cliffX + (vestedPct / 100) * (SVG_W - cliffX)}
            y2={SVG_H}
            stroke="var(--text)"
            strokeWidth={1}
            opacity={0.4}
          />
        )}
      </svg>

      <div className="schedule-axis">
        {cliff > 0n ? (
          <span>cliff ({daysLabel(cliff)})</span>
        ) : (
          <span>start</span>
        )}
        <span className="muted">
          {beforeCliff
            ? "before cliff"
            : now >= endAt
              ? "fully vested"
              : `${vestedPct.toFixed(1)}% vested`}
        </span>
        <span>end ({daysLabel(duration)})</span>
      </div>
    </div>
  );
}
