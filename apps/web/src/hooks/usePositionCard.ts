import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Position } from "@/lib/positions";
import { RPC_URL } from "@/lib/network";
import type { ContractClientOptions as ClientOptions } from "@/lib/rpc";
import { useRpc } from "@/lib/rpc-provider";

interface PositionClient {
  get(): Promise<unknown>;
}

export function usePositionCard<ClientType extends PositionClient>(
  ClientConstructor: new (opts: ClientOptions) => ClientType,
  position: Position,
  address: string | null,
  onRefresh?: (client: ClientType, isCurrent: () => boolean) => Promise<void>,
) {
  type DataType = Awaited<ReturnType<ClientType["get"]>>;
  const [data, setData] = useState<DataType | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  // When the data was last read from the chain, and whether a read is in flight (#426).
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeRequestIdRef = useRef(0);

  const { clientOptions } = useRpc();
  // Memoised by contract id, signer and network (the provider's RPC), so the
  // client keeps its identity across re-renders and its caches and effects
  // are not reset on every render (#442).
  const client = useMemo(
    () => new ClientConstructor(clientOptions(position.contractId, address)),
    [ClientConstructor, clientOptions, position.contractId, address],
  );

  // Reads do not need a wallet (#446): without one the client simulates from
  // the null account, so a viewer can see a position before connecting.
  const refresh = useCallback(async () => {
    if (position.network && position.network !== RPC_URL) return;
    const requestId = ++activeRequestIdRef.current;
    const isCurrent = () => requestId === activeRequestIdRef.current;
    setIsRefreshing(true);
    try {
      const result = (await client.get()) as DataType;
      if (!isCurrent()) return;
      setData(result);
      setLoadError(null);
      setLastUpdatedAt(Date.now());
      if (onRefresh) {
        await onRefresh(client, isCurrent);
      }
    } catch (error) {
      if (!isCurrent()) return;
      setLoadError(error);
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [client, address, position.network, onRefresh]);

  useEffect(() => {
    void refresh();
    return () => {
      activeRequestIdRef.current += 1;
    };
  }, [refresh]);

  return { data, loadError, client, refresh, isLoading, isRefreshing, lastUpdatedAt };
}
