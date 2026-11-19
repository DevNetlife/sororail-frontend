"use client";

import { useEffect, useState } from "react";

import { useRpc } from "@/lib/rpc-provider";
import { fetchTokenMetadata, type TokenMetadata } from "@/lib/token";

export type TokenMetadataState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; metadata: TokenMetadata }
  | { status: "error"; error: Error };

/** Token `symbol`/`name`/`decimals` for a contract id, read through the shared (cached) token reader. */
export function useTokenMetadata(tokenId: string | undefined): TokenMetadataState {
  const { server } = useRpc();
  const [state, setState] = useState<TokenMetadataState>(
    tokenId ? { status: "loading" } : { status: "idle" },
  );

  useEffect(() => {
    if (!tokenId) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetchTokenMetadata(tokenId, server).then(
      (metadata) => {
        if (!cancelled) setState({ status: "ready", metadata });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tokenId, server]);

  return state;
}
