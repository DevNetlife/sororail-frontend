"use client";

import { useEffect, useMemo, useState } from "react";

import type { PositionKind } from "@/lib/positions";

/** "Updated N s ago" for a card's last chain read (#426). */
export function formatUpdatedAgo(lastUpdatedAt: number | null | undefined, now: number): string {
  if (lastUpdatedAt === null || lastUpdatedAt === undefined) return "Not read yet";
  const seconds = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  if (seconds < 60) return `Updated ${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  return `Updated ${Math.floor(minutes / 60)} h ago`;
}

/** Manual refresh control with a live "updated N s ago" label (#426). */
export function PositionRefresh({
  onRefresh,
  isRefreshing,
  lastUpdatedAt,
}: {
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
  lastUpdatedAt?: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setNow(Date.now());
  }, [lastUpdatedAt]);

  return (
    <div className="row">
      <span className="small muted" data-testid="position-updated">
        {formatUpdatedAgo(lastUpdatedAt, now)}
      </span>
      <button
        type="button"
        className="button--quiet"
        onClick={() => void onRefresh()}
        disabled={isRefreshing === true}
        aria-busy={isRefreshing === true}
      >
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}

/** JSON for the raw struct view: `bigint` values become strings so nothing loses precision (#425). */
export function toDisplayJson(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item), 2) ??
    "null"
  );
}

/** Collapsible view of exactly what the contract returned, with a copy button (#425). */
export function PositionDetails({ kind, data }: { kind: PositionKind; data: unknown }) {
  const json = useMemo(() => toDisplayJson(data), [data]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <details className="stack stack--tight" data-testid={`position-details-${kind}`}>
      <summary className="small">Raw on-chain data</summary>
      <pre className="mono small" style={{ overflowX: "auto", margin: 0 }}>
        {json}
      </pre>
      <div className="row">
        <button type="button" className="button--quiet" onClick={() => void copy()}>
          Copy JSON
        </button>
        {copyState === "copied" ? <span className="small muted">Copied</span> : null}
        {copyState === "failed" ? <span className="small text-danger">Could not copy</span> : null}
      </div>
    </details>
  );
}
