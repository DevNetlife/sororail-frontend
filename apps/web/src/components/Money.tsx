"use client";

import { memo, useState } from "react";

import { CopyButton } from "@/components/CopyButton";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { formatTokenAmount } from "@/lib/format";
import { explorerContract, shortAddress } from "@/lib/network";

export interface MoneyProps {
  value: bigint;
  unit?: string;
  size?: "lg";
  direction?: "incoming" | "outgoing";
  /**
   * Marks a figure that is already stale when rendered.
   *
   * Stream and vesting accrual is computed from ledger time, so an "available"
   * balance keeps rising between the read and the transaction landing. A live
   * run once reported 0.00016 and withdrew 0.00026 seconds later — both
   * correct. Showing such a number as exact invites a support ticket, so it is
   * prefixed with "≥".
   */
  approximate?: boolean;
  /** The token's decimals; omit for the classic 7. */
  decimals?: number | undefined;
  /**
   * The token contract id (#411). When set, the token's own `symbol()` is shown
   * (its `name()` in the tooltip) instead of `unit`, so an amount in a
   * non-native token is never ambiguous. A token whose metadata can't be read
   * degrades to its shortened contract id.
   */
  token?: string | undefined;
}

/** The unit label for a token contract: its symbol once read, `fallback` while loading, its id on failure. */
function TokenUnit({ token, fallback }: { token: string; fallback?: string }) {
  const state = useTokenMetadata(token);
  if (state.status === "ready") {
    return (
      <span className="amount__unit" title={state.metadata.name}>
        {state.metadata.symbol}
      </span>
    );
  }
  const id = shortAddress(token, 4);
  if (state.status === "error") {
    return (
      <span className="amount__unit" title={token}>
        {id}
      </span>
    );
  }
  return <span className="amount__unit">{fallback ?? id}</span>;
}

/**
 * A monetary figure.
 *
 * Amounts get more typographic weight than the labels around them and use
 * tabular figures so a column of them lines up digit for digit. Digits and
 * separators follow the viewer's locale through `lib/format` (#410).
 */
export const Money = memo(function Money({
  value,
  unit,
  size,
  direction,
  approximate = false,
  decimals,
  token,
}: MoneyProps) {
  const classes = [
    "amount",
    size === "lg" ? "amount--lg" : "",
    direction ? `amount--${direction}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      title={approximate ? "At least this much — accrual continues" : undefined}
    >
      {approximate ? (
        <>
          <span className="amount__approx" aria-hidden="true">
            ≥
          </span>
          <span className="sr-only">At least </span>
        </>
      ) : null}
      {formatTokenAmount(value, decimals ?? 7)}
      {token ? (
        <TokenUnit token={token} {...(unit === undefined ? {} : { fallback: unit })} />
      ) : (
        <span className="amount__unit">{unit ?? "XLM"}</span>
      )}
    </span>
  );
});

/** A contract or account address, shortened but copyable in full. */
export function Address({
  value,
  href,
  explorer = false,
}: {
  value: string;
  href?: string;
  /** When true, automatically links to the block explorer for this contract address. */
  explorer?: boolean;
}) {
  const short = shortAddress(value, 6);
  const explorerHref = explorer ? explorerContract(value) : null;
  const resolvedHref = href ?? explorerHref ?? undefined;

  const label = (
    <>
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{value}</span>
    </>
  );

  return (
    <span className="addr-wrap">
      {resolvedHref ? (
        <a className="addr" href={resolvedHref} target="_blank" rel="noopener noreferrer" title={value}>
          {label}
        </a>
      ) : (
        <span className="addr" title={value}>
          {label}
        </span>
      )}
      <CopyButton text={value} label="Copy address" />
    </span>
  );
}
