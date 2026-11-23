import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { NetworkError, decodeError } from "../errors/index.js";

export type TransactionStatus = "SUCCESS" | "FAILED" | "NOT_FOUND";

export interface WaitForTransactionOptions {
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
}

export interface TransactionResult<T = unknown> {
  status: TransactionStatus;
  ledger?: number;
  returnValue?: T;
}

/**
 * Wait for a transaction to be confirmed with timeout and abort support.
 *
 * Polls getTransaction until the transaction reaches a terminal state or the
 * timeout is exceeded.
 *
 * @param server - The RPC server instance
 * @param hash - Transaction hash to poll
 * @param options - Configuration for timeout, interval, and abort signal
 * @returns Transaction result with status, ledger, and decoded return value
 * @throws {NetworkError} When the transaction cannot be retrieved or times out
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * const result = await waitForTransaction(server, hash, {
 *   timeoutMs: 60_000,
 *   intervalMs: 1_000,
 *   signal: controller.signal
 * });
 *
 * if (result.status === "SUCCESS") {
 *   console.log("Transaction confirmed in ledger", result.ledger);
 *   console.log("Return value:", result.returnValue);
 * }
 * ```
 */
export async function waitForTransaction<T = unknown>(
  server: rpc.Server,
  hash: string,
  options: WaitForTransactionOptions = {},
): Promise<TransactionResult<T>> {
  const { timeoutMs = 60_000, intervalMs = 1_000, signal } = options;
  const startTime = Date.now();

  while (true) {
    if (signal?.aborted) {
      throw new NetworkError("Transaction polling aborted by signal.");
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new NetworkError(
        `Transaction ${hash} did not reach a terminal state within ${timeoutMs}ms. It may still be processing.`,
      );
    }

    let response: rpc.Api.GetTransactionResponse;
    try {
      response = await server.getTransaction(hash);
    } catch (cause) {
      throw new NetworkError(
        `Failed to fetch transaction status for ${hash}.`,
        { cause },
      );
    }

    if (response.status === "SUCCESS") {
      const retval = response.returnValue;
      return {
        status: "SUCCESS",
        ledger: response.ledger,
        returnValue: retval === undefined ? undefined : scValToNative(retval),
      };
    }

    if (response.status === "FAILED") {
      const error = decodeError(
        (response as { resultXdr?: unknown }).resultXdr ??
          `Transaction ${hash} failed.`,
      );
      throw error;
    }

    if (response.status === "NOT_FOUND") {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    throw new NetworkError(
      `Unexpected transaction status for ${hash}: ${response.status}`,
    );
  }
}
