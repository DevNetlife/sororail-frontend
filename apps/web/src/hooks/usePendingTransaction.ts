import { useCallback, useEffect, useRef, useState } from "react";

/** How long a transaction may stay unconfirmed before the banner says so (#398). */
export const PENDING_TIMEOUT_MS = 45_000;

const TICK_MS = 1_000;

export type PendingTransactionStatus = "idle" | "pending" | "timeout" | "success";

interface RunState {
  status: PendingTransactionStatus;
  hash: string | undefined;
  startedAt: number | null;
  endedAt: number | null;
  now: number;
}

const IDLE_RUN: RunState = { status: "idle", hash: undefined, startedAt: null, endedAt: null, now: 0 };

export interface PendingTransactionOptions {
  /** True from the moment a transaction is signed until it is confirmed or fails. */
  pending: boolean;
  /** The transaction hash, once the caller knows it. */
  hash?: string;
  /** Milliseconds before a still-pending run becomes `timeout`. */
  timeoutMs?: number;
}

export interface PendingTransactionState {
  status: PendingTransactionStatus;
  hash: string | undefined;
  /** Whole seconds since the run started; frozen once it ends. */
  elapsedSeconds: number;
  /** Hides the banner for the current run. The next run shows it again. */
  dismiss: () => void;
}

/**
 * Tracks one in-flight transaction for a banner. The caller reports whether
 * a transaction is pending and its hash; this hook keeps the elapsed time and
 * the pending, timeout and success states.
 *
 * `timeout` is not a failure: the transaction may still land, so the state
 * stays until the run resolves or the banner is dismissed. A run that ends
 * without a new hash (a failure) clears back to `idle`; the page's own error
 * notice reports it.
 */
export function usePendingTransaction({
  pending,
  hash,
  timeoutMs = PENDING_TIMEOUT_MS,
}: PendingTransactionOptions): PendingTransactionState {
  const [run, setRun] = useState<RunState>(IDLE_RUN);
  const wasPending = useRef(false);
  const hashAtStart = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (pending && !wasPending.current) {
      wasPending.current = true;
      hashAtStart.current = hash;
      const started = Date.now();
      setRun({ status: "pending", hash, startedAt: started, endedAt: null, now: started });
    } else if (!pending && wasPending.current) {
      wasPending.current = false;
      const ended = Date.now();
      setRun((previous) => {
        if (previous.status === "idle") return previous;
        if (hash && hash !== hashAtStart.current) {
          return { ...previous, status: "success", hash, endedAt: ended, now: ended };
        }
        return IDLE_RUN;
      });
    }
    // `hash` is read at start and end only; a change mid-run is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (!wasPending.current || !hash) return;
    setRun((previous) =>
      previous.status === "pending" || previous.status === "timeout" ? { ...previous, hash } : previous,
    );
  }, [hash]);

  useEffect(() => {
    if (run.status !== "pending" && run.status !== "timeout") return;
    const id = setInterval(() => {
      setRun((previous) => ({ ...previous, now: Date.now() }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [run.status]);

  useEffect(() => {
    if (run.status !== "pending") return;
    const id = setTimeout(() => {
      setRun((previous) =>
        previous.status === "pending" ? { ...previous, status: "timeout", now: Date.now() } : previous,
      );
    }, timeoutMs);
    return () => clearTimeout(id);
  }, [run.status, run.startedAt, timeoutMs]);

  const dismiss = useCallback(() => setRun(IDLE_RUN), []);

  const elapsedSeconds =
    run.startedAt === null
      ? 0
      : Math.max(0, Math.floor(((run.endedAt ?? run.now) - run.startedAt) / 1000));

  return { status: run.status, hash: run.hash, elapsedSeconds, dismiss };
}
