"use client";

import { explorerTx } from "@/lib/network";

function TxLink({ hash }: { hash: string }) {
  const href = explorerTx(hash);
  const short = `${hash.slice(0, 8)}…`;
  if (!href) return <span className="addr">{short}</span>;
  return (
    <a className="addr" href={href} target="_blank" rel="noopener noreferrer">
      {short}
    </a>
  );
}

export type ChunkState = "pending" | "signed" | "confirmed" | "failed";

export interface ChunkStatus {
  /** Recipients in this batch. */
  count: number;
  state: ChunkState;
  /** Transaction hash once the batch is confirmed. */
  hash?: string;
  /** Why the batch failed, as shown to the operator. */
  error?: string;
}

const LABEL: Record<ChunkState, string> = {
  pending: "Pending",
  signed: "Signed, waiting for the network",
  confirmed: "Confirmed",
  failed: "Failed",
};

/**
 * Per-batch status for a payroll split into several transactions (#422). Each
 * batch is all-or-nothing on its own, so a failed batch can be retried without
 * re-sending the ones already confirmed.
 */
export function PayrollChunkProgress({
  chunks,
  busy,
  onRetry,
}: {
  chunks: readonly ChunkStatus[];
  busy: boolean;
  onRetry: (index: number) => void;
}) {
  if (chunks.length < 2) return null;
  const done = chunks.filter((chunk) => chunk.state === "confirmed").length;
  return (
    <section className="stack stack--tight" aria-label="Batch progress">
      <div className="label">
        {done} of {chunks.length} batches confirmed
      </div>
      <ol className="stack stack--tight m-0">
        {chunks.map((chunk, index) => (
          <li key={index} data-state={chunk.state} className="small">
            <span>
              Batch {index + 1} of {chunks.length} ({chunk.count} recipient{chunk.count === 1 ? "" : "s"}):{" "}
            </span>
            <strong className={chunk.state === "failed" ? "text-danger" : undefined}>{LABEL[chunk.state]}</strong>
            {chunk.hash ? (
              <>
                {" "}
                <TxLink hash={chunk.hash} />
              </>
            ) : null}
            {chunk.state === "failed" ? (
              <>
                {chunk.error ? <span className="muted"> {chunk.error}</span> : null}{" "}
                <button type="button" disabled={busy} onClick={() => onRetry(index)}>
                  Retry batch {index + 1}
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
