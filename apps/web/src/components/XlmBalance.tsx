"use client";

import { useEffect, useState } from "react";

import { FRIENDBOT_URL } from "@/lib/network";
import { fetchXlmBalance, isLowBalance } from "@/lib/xlm-balance";

export function XlmBalance({
  address,
  load = fetchXlmBalance,
}: {
  address: string;
  load?: (address: string) => Promise<number>;
}) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(address)
      .then((value) => {
        if (!cancelled) setBalance(value);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, load]);

  if (balance === null) return null;

  return (
    <span className="row">
      <span data-testid="xlm-balance">{balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM</span>
      {isLowBalance(balance) ? (
        <a
          className="notice notice--warn"
          role="status"
          href={`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noreferrer"
        >
          Low XLM for fees — fund with Friendbot
        </a>
      ) : null}
    </span>
  );
}
