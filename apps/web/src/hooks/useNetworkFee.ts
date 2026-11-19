"use client";

import { useEffect, useRef, useState } from "react";

import type { NetworkFeeState } from "@/lib/network-fee";

/**
 * Estimates the network fee for one pending action (#399).
 *
 * `estimate` runs once per `key` (for example the action being confirmed), not
 * on every render, so an inline closure does not restart the simulation. A
 * failed estimate resolves to `unavailable` and never throws. A result for an
 * earlier key is dropped, so a slow estimate cannot overwrite a newer one.
 */
export function useNetworkFee(key: string, estimate: () => Promise<bigint>): NetworkFeeState {
  const [state, setState] = useState<{ key: string; fee: NetworkFeeState }>({
    key,
    fee: { status: "loading" },
  });
  const estimateRef = useRef(estimate);

  useEffect(() => {
    estimateRef.current = estimate;
  });

  useEffect(() => {
    let current = true;
    setState({ key, fee: { status: "loading" } });
    estimateRef
      .current()
      .then(
        (stroops) => {
          if (current) setState({ key, fee: { status: "ready", stroops } });
        },
        () => {
          if (current) setState({ key, fee: { status: "unavailable" } });
        },
      );
    return () => {
      current = false;
    };
  }, [key]);

  // A state left over from a previous key is still loading for this one.
  return state.key === key ? state.fee : { status: "loading" };
}
