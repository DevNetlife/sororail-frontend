import { rpc } from "@stellar/stellar-sdk";

import { NETWORK_PASSPHRASE, RPC_URL } from "./network";

/** What every generated contract client is constructed with. */
export interface ContractClientOptions {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  publicKey?: string;
}

/**
 * One RPC server and the options every contract client needs, built in one
 * place (#441). Components used to construct their own `rpc.Server` and
 * repeat the URL and passphrase, so nothing could share a connection or
 * point the whole app at a different RPC in a test.
 */
export interface Rpc {
  rpcUrl: string;
  networkPassphrase: string;
  server: rpc.Server;
  clientOptions(contractId: string, publicKey?: string | null): ContractClientOptions;
}

export function createRpc(
  rpcUrl: string = RPC_URL,
  networkPassphrase: string = NETWORK_PASSPHRASE,
): Rpc {
  return {
    rpcUrl,
    networkPassphrase,
    // A local quickstart node is plain http; the SDK refuses that unless asked.
    server: new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") }),
    clientOptions: (contractId, publicKey) => ({
      contractId,
      rpcUrl,
      networkPassphrase,
      ...(publicKey ? { publicKey } : {}),
    }),
  };
}

let defaultRpc: Rpc | null = null;

/** The app-wide instance for code outside React, and the fallback when no `RpcProvider` is mounted. */
export function getDefaultRpc(): Rpc {
  defaultRpc ??= createRpc();
  return defaultRpc;
}
