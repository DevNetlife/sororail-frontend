"use client";

import { formatTokenAmount } from "@/lib/format";

interface AccrualChartProps {
  start: bigint;
  stop: bigint;
  now: bigint;
  deposited: bigint;
  ratePerSecond: bigint;
  withdrawn: bigint;
}

const W = 300;
const H = 72;
const AXIS_H = 18;

function clamp(v: bigint, lo: bigint, hi: bigint): bigint {
  return v < lo ? lo : v > hi ? hi : v;
}

function pctNum(num: bigint, den: bigint): number {
  if (den === 0n) return 0;
  return Math.min(100, Math.max(0, Number((num * 10000n) / den) / 100));
}

/** SVG area chart showing cumulative accrual for a stream over its lifetime. */
export function AccrualChart({
  start,
  stop,
  now,
  deposited,
  ratePerSecond,
  withdrawn,
}: AccrualChartProps) {
  if (deposited === 0n || stop <= start) return null;

  const duration = stop - start;
  const nowClamped = clamp(now, start, stop);
  const elapsed = nowClamped - start;

  const rawAccrued = elapsed * ratePerSecond;
  const accrued = rawAccrued > deposited ? deposited : rawAccrued;
  const cappedWithdrawn = withdrawn > accrued ? accrued : withdrawn;

  const elapsedPct = pctNum(elapsed, duration);
  const accruedPct = pctNum(accrued, deposited);
  const withdrawnPct = pctNum(cappedWithdrawn, deposited);

  const nowX = (elapsedPct / 100) * W;
  const accruedY = H - (accruedPct / 100) * H;
  const withdrawnY = H - (withdrawnPct / 100) * H;

  return (
    <div>
      <div className="label" style={{ marginBottom: "0.25rem" }}>
        Accrual
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + AXIS_H}`}
        width="100%"
        style={{ display: "block" }}
        role="img"
        aria-label={`Accrual chart: ${formatTokenAmount(accrued)} of ${formatTokenAmount(deposited)} XLM accrued`}
      >
        {/* Background */}
        <rect x={0} y={0} width={W} height={H} rx={3} fill="var(--surface-sunken)" />

        {/* Accrued area */}
        <polygon
          points={`0,${H} ${nowX},${accruedY} ${nowX},${H}`}
          fill="var(--accent)"
          opacity={0.75}
        />

        {/* Withdrawn layer (darker) */}
        {cappedWithdrawn > 0n && (
          <polygon
            points={`0,${H} ${nowX},${withdrawnY} ${nowX},${H}`}
            fill="var(--accent)"
            opacity={0.4}
          />
        )}

        {/* Projected line to end */}
        {elapsedPct < 100 && (
          <line
            x1={nowX}
            y1={accruedY}
            x2={W}
            y2={0}
            stroke="var(--border-strong)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        )}

        {/* Now marker */}
        {elapsedPct > 2 && elapsedPct < 98 && (
          <line
            x1={nowX}
            y1={0}
            x2={nowX}
            y2={H}
            stroke="var(--text)"
            strokeWidth={1}
            opacity={0.3}
          />
        )}

        {/* Axis labels */}
        <text
          x={2}
          y={H + AXIS_H - 3}
          fontSize={10}
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
        >
          0
        </text>
        {elapsedPct > 10 && elapsedPct < 88 && (
          <text
            x={nowX}
            y={H + AXIS_H - 3}
            fontSize={10}
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
          >
            now
          </text>
        )}
        <text
          x={W - 2}
          y={H + AXIS_H - 3}
          fontSize={10}
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
          textAnchor="end"
        >
          {formatTokenAmount(deposited)} XLM
        </text>
      </svg>
    </div>
  );
}
