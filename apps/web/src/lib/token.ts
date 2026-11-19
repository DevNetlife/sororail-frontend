import {
  Account,
  BASE_FEE,
  Operation,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

import { NETWORK_PASSPHRASE } from "./network";
import { getDefaultRpc } from "./rpc";

/**
 * Reads `decimals()` off a token contract.
 *
 * Amounts are entered as decimal strings and converted to the token's smallest
 * unit, so the scale has to come from the token itself: 7 is only the default
 * for classic Stellar assets, and a custom token can declare anything.
 */
export async function fetchTokenDecimals(
  tokenId: string,
  sourceAddress: string,
  server: rpc.Server = getDefaultRpc().server,
): Promise<number> {
  const transaction = new TransactionBuilder(new Account(sourceAddress, "0"), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: tokenId,
        function: "decimals",
        args: [],
      }),
    )
    .setTimeout(30)
    .build();

  const response = await server.simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(response) || !response.result) {
    throw new Error("Could not read the token's decimals.");
  }
  const decimals = Number(scValToNative(response.result.retval));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38) {
    throw new Error(`The token reported an invalid decimals value: ${decimals}.`);
  }
  return decimals;
}

/** What a token contract says about itself (#411, #412). */
export interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
}

/** Thrown when the contract does not answer the token interface (`symbol`, `name`, `decimals`). */
export class NotATokenError extends Error {}

/** Read-only simulations need a source account but never sign; the SDK uses the same all-zero account. */
const READ_ONLY_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

async function readTokenField(
  tokenId: string,
  fn: "symbol" | "name" | "decimals",
  server: rpc.Server,
): Promise<unknown> {
  const transaction = new TransactionBuilder(new Account(READ_ONLY_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.invokeContractFunction({ contract: tokenId, function: fn, args: [] }))
    .setTimeout(30)
    .build();
  const response = await server.simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(response) || !response.result) {
    throw new NotATokenError(`This contract does not look like a token (no ${fn}()).`);
  }
  return scValToNative(response.result.retval);
}

const metadataCache = new Map<string, Promise<TokenMetadata>>();

/**
 * Reads `symbol()`, `name()` and `decimals()` from a token contract, cached per
 * contract id so a page full of amounts in the same token costs one set of
 * reads. A failed read is evicted so it can be retried.
 */
export function fetchTokenMetadata(
  tokenId: string,
  server: rpc.Server = getDefaultRpc().server,
): Promise<TokenMetadata> {
  const cached = metadataCache.get(tokenId);
  if (cached) return cached;
  const pending = (async () => {
    const [symbol, name, decimals] = await Promise.all([
      readTokenField(tokenId, "symbol", server),
      readTokenField(tokenId, "name", server),
      readTokenField(tokenId, "decimals", server),
    ]);
    const d = Number(decimals);
    if (typeof symbol !== "string" || typeof name !== "string" || !Number.isInteger(d) || d < 0 || d > 38) {
      throw new NotATokenError("This contract returned values that are not token metadata.");
    }
    return { symbol, name, decimals: d };
  })();
  metadataCache.set(tokenId, pending);
  pending.catch(() => metadataCache.delete(tokenId));
  return pending;
}

/** Test seam. */
export function clearTokenMetadataCache(): void {
  metadataCache.clear();
}
