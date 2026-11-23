import {
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  type Transaction,
  type xdr,
} from "@stellar/stellar-sdk";

import { NetworkError, TimeoutError, ValidationError, decodeError } from "../errors/index.js";
import type { Signer } from "../signers/index.js";
import { isValidAccountId, isValidContractId } from "../utils/validation.js";

/** Connection and contract details every client needs. */
export interface ClientOptions {
  /** The deployed contract address (`C...`). */
  contractId: string;
  /** Soroban RPC endpoint. */
  rpcUrl: string;
  /** Network passphrase, e.g. `Networks.TESTNET`. */
  networkPassphrase: string;
  /**
   * Account that builds and simulates calls. Required for anything that
   * touches the network; the signer's key is the usual choice.
   */
  publicKey?: string;
  /**
   * Inclusion fee in stroops. Defaults to `BASE_FEE`.
   *
   * The fee is deducted from the account's balance for each transaction built
   * and submitted, even if the transaction later fails. Choose a fee that
   * reflects the current network congestion to avoid overpaying or timing out.
   */
  fee?: string;
  /** Transaction validity window in seconds. Defaults to 30. */
  timeoutSeconds?: number;
  /**
   * Allow plain HTTP connections. Only for a local quickstart node.
   *
   * ⚠️ **Security warning**: Enabling this for a remote RPC URL sends
   * unsigned/simulated transaction data over plaintext HTTP. This exposes
   * contract calls, amounts, recipient addresses, and account state to
   * network eavesdropping. Use only with local nodes where the RPC connection
   * does not cross untrusted networks. For remote RPC endpoints, always use
   * HTTPS (the default; this must remain `false`).
   */
  allowHttp?: boolean;
  /**
   * Retry configuration for transient RPC errors.
   *
   * Defaults to 3 attempts with 100ms base delay and exponential backoff.
   * Only idempotent reads and simulations are retried; submissions never are.
   */
  retry?: {
    /** Maximum number of attempts (including the initial call). Defaults to 3. */
    attempts?: number;
    /** Base delay in milliseconds before the first retry. Defaults to 100. */
    baseDelayMs?: number;
  };
  /**
   * Maximum time in milliseconds to wait for each RPC call.
   *
   * When exceeded, the call is aborted with a TimeoutError. Applies to
   * simulations, submissions, and reads. Does not affect transaction
   * confirmation polling (use timeoutSeconds for that).
   */
  timeoutMs?: number;
  /**
   * Multiplier applied to simulated fees before submission. Defaults to 1.0.
   *
   * Use values greater than 1.0 during surge pricing to reduce the chance of
   * txINSUFFICIENT_FEE failures. For example, 1.5 adds a 50% buffer.
   */
  feeMultiplier?: number;
  /**
   * Maximum fee in stroops willing to pay after the multiplier is applied.
   *
   * When the computed fee exceeds this cap, the transaction is rejected before
   * submission. Protects against runaway costs during extreme network load.
   */
  maxFee?: string;
}

/** A submitted transaction and its decoded return value. */
export interface SentCall<T> {
  /** Transaction hash, for a block explorer link. */
  hash: string;
  /** The contract's return value, decoded. */
  result: T;
}

/**
 * A built, unsent contract call.
 *
 * The stages are deliberately separate — build, simulate, sign, send, confirm
 * — so a caller can inspect exactly what a transaction will do before asking
 * anyone to sign it. That is what makes a confirmation screen honest, so
 * nothing here collapses the steps behind a single "just do it" call.
 */
export class PreparedCall<T> {
  readonly #server: rpc.Server;
  readonly #built: Transaction;
  readonly #parse: (value: unknown) => T;
  readonly #networkPassphrase: string;
  readonly #retryConfig: { attempts: number; baseDelayMs: number };
  readonly #signal?: AbortSignal;
  readonly #feeMultiplier: number;
  readonly #maxFee?: string;

  constructor(args: {
    server: rpc.Server;
    built: Transaction;
    parse: (value: unknown) => T;
    networkPassphrase: string;
    retryConfig: { attempts: number; baseDelayMs: number };
    signal?: AbortSignal;
    feeMultiplier?: number;
    maxFee?: string;
  }) {
    this.#server = args.server;
    this.#built = args.built;
    this.#parse = args.parse;
    this.#networkPassphrase = args.networkPassphrase;
    this.#retryConfig = args.retryConfig;
    this.#signal = args.signal;
    this.#feeMultiplier = args.feeMultiplier ?? 1.0;
    this.#maxFee = args.maxFee;
  }

  /** The unsigned transaction, as base64 XDR. */
  toXDR(): string {
    return this.#built.toXDR();
  }

  async #retryOnTransient<T>(
    operation: () => Promise<T>,
    isRetryable: (error: unknown) => boolean,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.#retryConfig.attempts; attempt++) {
      if (this.#signal?.aborted) {
        throw new TimeoutError("RPC call aborted: request timeout exceeded.");
      }

      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === this.#retryConfig.attempts - 1) {
          throw error;
        }

        const delay = this.#retryConfig.baseDelayMs * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  #isTransientError(error: unknown): boolean {
    if (error instanceof NetworkError) {
      const cause = error.cause;
      if (cause instanceof Error) {
        const message = cause.message.toLowerCase();
        if (message.includes("429") || message.includes("503") || message.includes("econnreset") || message.includes("network")) {
          return true;
        }
      }
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes("429") || message.includes("503") || message.includes("econnreset");
    }
    return false;
  }

  /**
   * Runs the call without submitting it, returning what it would produce.
   *
   * This is how read-only methods are called, and how a write should be
   * previewed: a simulation that fails tells you the write would fail, before
   * a signature is requested and before any fee is spent.
   */
  async simulate(): Promise<T> {
    return this.#retryOnTransient(
      async () => {
        let response: rpc.Api.SimulateTransactionResponse;
        try {
          response = await this.#server.simulateTransaction(this.#built);
        } catch (cause) {
          throw new NetworkError("Could not reach the network to simulate this call.", {
            cause,
          });
        }

        if (rpc.Api.isSimulationError(response)) {
          throw decodeError(response.error);
        }
        if (!rpc.Api.isSimulationSuccess(response)) {
          throw new NetworkError(
            "The simulation did not complete. The network may be restoring archived state.",
          );
        }

        const retval = response.result?.retval;
        return this.#parse(retval === undefined ? undefined : scValToNative(retval));
      },
      (error) => this.#isTransientError(error),
    );
  }

  /**
   * Simulates, asks the signer to sign, submits, and waits for the result.
   *
   * The simulation runs first so that a doomed transaction is rejected before
   * the user is prompted.
   */
  async signAndSend(signer: Signer): Promise<SentCall<T>> {
    let assembled: Transaction;
    try {
      assembled = await this.#server.prepareTransaction(this.#built);
    } catch (cause) {
      throw decodeError(cause);
    }

    if (this.#feeMultiplier > 1.0) {
      const currentFee = BigInt(assembled.fee);
      const adjustedFee = BigInt(Math.ceil(Number(currentFee) * this.#feeMultiplier));
      
      if (this.#maxFee !== undefined) {
        const maxFeeBigInt = BigInt(this.#maxFee);
        if (adjustedFee > maxFeeBigInt) {
          throw new ValidationError(
            `Computed fee ${adjustedFee} exceeds maxFee ${this.#maxFee}. Current network conditions require more than the configured maximum.`,
          );
        }
      }

      assembled = TransactionBuilder.cloneFrom(assembled, { fee: adjustedFee.toString() })
        .build();
    }

    const signedXdr = await signer.signTransaction(assembled.toXDR(), {
      networkPassphrase: this.#networkPassphrase,
    });
    const signed = TransactionBuilder.fromXDR(
      signedXdr,
      this.#networkPassphrase,
    ) as Transaction;

    let sent: rpc.Api.SendTransactionResponse;
    try {
      sent = await this.#server.sendTransaction(signed);
    } catch (cause) {
      throw new NetworkError("Could not submit the transaction.", { cause });
    }
    if (sent.status === "ERROR") {
      throw decodeError(sent.errorResult ?? "The network rejected the transaction.");
    }

    const confirmed = await this.#confirm(sent.hash);
    return { hash: sent.hash, result: confirmed };
  }

  /** Polls until the transaction is in a ledger, then decodes its result. */
  async #confirm(hash: string): Promise<T> {
    let response: rpc.Api.GetTransactionResponse;
    try {
      response = await this.#server.pollTransaction(hash, {
        attempts: 30,
        sleepStrategy: () => 1000,
      });
    } catch (cause) {
      throw new NetworkError(
        `The transaction was submitted (${hash}) but its result could not be read back. It may still have succeeded — check the hash before retrying.`,
        { cause },
      );
    }

    if (response.status === "SUCCESS") {
      const retval = response.returnValue;
      return this.#parse(retval === undefined ? undefined : scValToNative(retval));
    }
    if (response.status === "NOT_FOUND") {
      throw new NetworkError(
        `The transaction (${hash}) was not visible on the network in time. It may still land — check the hash before retrying.`,
      );
    }
    throw decodeError(
      (response as { resultXdr?: unknown }).resultXdr ??
        `Transaction ${hash} failed.`,
    );
  }
}

/** Shared plumbing for the per-contract clients. */
export abstract class BaseClient {
  protected readonly server: rpc.Server;
  protected readonly contract: Contract;
  protected readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    if (!isValidContractId(options.contractId)) {
      throw new ValidationError(
        `Invalid contract ID: "${options.contractId}". Expected a valid C... StrKey address.`,
      );
    }
    if (options.publicKey && !isValidAccountId(options.publicKey)) {
      throw new ValidationError(
        `Invalid public key: "${options.publicKey}". Expected a valid G... StrKey address.`,
      );
    }
    this.options = options;
    this.server = new rpc.Server(options.rpcUrl, {
      allowHttp: options.allowHttp ?? false,
    });
    this.contract = new Contract(options.contractId);
  }

  /** The deployed contract address this client talks to. */
  get contractId(): string {
    return this.options.contractId;
  }

  /**
   * Fetches contract events with automatic pagination.
   *
   * Returns an async iterable that handles cursor-based pagination and the RPC
   * retention window. Events are yielded as decoded XDR values ready for
   * further processing with decodeEvent.
   *
   * @param options.fromLedger Starting ledger sequence (inclusive). Defaults to 0.
   * @param options.limit Maximum number of events to fetch per page. Defaults to 100.
   * @yields Raw events with topics and data
   */
  async *events(options?: {
    fromLedger?: number;
    limit?: number;
  }): AsyncIterable<{ topics: xdr.ScVal[]; data: xdr.ScVal; ledger: number }> {
    const limit = options?.limit ?? 100;
    let startLedger = options?.fromLedger ?? 0;
    let cursor: string | undefined;

    while (true) {
      let response: rpc.Api.GetEventsResponse;
      try {
        response = await this.server.getEvents({
          startLedger,
          filters: [
            {
              type: "contract",
              contractIds: [this.contractId],
            },
          ],
          limit,
          cursor,
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (message.includes("ledger") && message.includes("not found")) {
          return;
        }
        throw new NetworkError("Could not fetch events.", { cause });
      }

      if (response.events.length === 0) {
        return;
      }

      for (const event of response.events) {
        if (event.type === "contract" && event.contractId === this.contractId) {
          yield {
            topics: event.topic,
            data: event.value,
            ledger: Number(event.ledger),
          };
        }
      }

      cursor = response.events[response.events.length - 1]?.pagingToken;
      if (!cursor || response.events.length < limit) {
        return;
      }
    }
  }

  /** Builds a call without simulating or sending it. */
  protected async prepare<T>(
    method: string,
    args: xdr.ScVal[],
    parse: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<PreparedCall<T>> {
    const { publicKey, networkPassphrase, timeoutMs } = this.options;
    if (!publicKey) {
      throw new ValidationError(
        "This client has no publicKey, so it cannot build a transaction. Pass one when constructing the client — the signer's address is the usual choice.",
      );
    }

    const effectiveSignal = timeoutMs !== undefined
      ? AbortSignal.timeout(timeoutMs)
      : signal;

    let source;
    try {
      source = await this.server.getAccount(publicKey);
    } catch (cause) {
      if (effectiveSignal?.aborted) {
        throw new TimeoutError("RPC call aborted: request timeout exceeded.");
      }
      throw new NetworkError(
        `Could not load account ${publicKey}. On testnet an account must be funded by friendbot before it can be used.`,
        { cause },
      );
    }

    const built = new TransactionBuilder(source, {
      fee: this.options.fee ?? BASE_FEE,
      networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(this.options.timeoutSeconds ?? 30)
      .build();

    const retryConfig = {
      attempts: this.options.retry?.attempts ?? 3,
      baseDelayMs: this.options.retry?.baseDelayMs ?? 100,
    };

    return new PreparedCall({
      server: this.server,
      built,
      parse,
      networkPassphrase,
      retryConfig,
      signal: effectiveSignal,
      feeMultiplier: this.options.feeMultiplier,
      maxFee: this.options.maxFee,
    });
  }

  /** Builds a call and simulates it immediately. For read-only methods. */
  protected async read<T>(
    method: string,
    args: xdr.ScVal[],
    parse: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T> {
    const call = await this.prepare(method, args, parse, signal);
    return call.simulate();
  }
}
