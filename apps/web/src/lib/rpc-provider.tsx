"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { NETWORK_PASSPHRASE, RPC_URL } from "./network";
import { createRpc, getDefaultRpc, type Rpc } from "./rpc";

const RpcContext = createContext<Rpc | null>(null);

/**
 * Provides one memoized RPC server and client factory to everything below it
 * (#441). It is rebuilt only when the URL or passphrase changes.
 */
export function RpcProvider({
  children,
  rpcUrl = RPC_URL,
  networkPassphrase = NETWORK_PASSPHRASE,
}: {
  children: ReactNode;
  rpcUrl?: string;
  networkPassphrase?: string;
}) {
  const value = useMemo(
    () => createRpc(rpcUrl, networkPassphrase),
    [rpcUrl, networkPassphrase],
  );
  return <RpcContext.Provider value={value}>{children}</RpcContext.Provider>;
}

/** The nearest provider's RPC, or the app-wide default when none is mounted (tests, isolated components). */
export function useRpc(): Rpc {
  return useContext(RpcContext) ?? getDefaultRpc();
}
