"use client";

import { ErrorNotice, SuccessNotice } from "@/components/Feedback";
import { Money } from "@/components/Money";
import { PayrollChunkProgress } from "@/components/PayrollChunkProgress";
import { PayrollFee } from "@/components/PayrollFee";
import type { PayrollState } from "@/hooks/usePayroll";

type ResultsProps = Pick<
  PayrollState,
  | "previewError"
  | "receipt"
  | "feeEstimate"
  | "batches"
  | "decimals"
  | "sendError"
  | "results"
  | "chunks"
  | "busy"
  | "confirming"
  | "retryFrom"
>;

/** What the chain said: the preview outcome, send errors and paid batches (#438). */
export function PayrollResults({
  previewError,
  receipt,
  feeEstimate,
  batches,
  decimals,
  sendError,
  results,
  chunks,
  busy,
  confirming,
  retryFrom,
}: ResultsProps) {
  return (
    <>
      {previewError ? <ErrorNotice error={previewError} /> : null}
      {receipt ? (
        <SuccessNotice>
          The contract accepts {receipt.count} recipients across{" "}
          {batches?.length ?? 0} batch{batches?.length === 1 ? "" : "es"},{" "}
          <Money value={receipt.total} decimals={decimals ?? undefined} /> total. Nothing has been sent.
        </SuccessNotice>
      ) : null}
      {receipt && feeEstimate ? <PayrollFee estimate={feeEstimate} /> : null}
      {sendError ? <ErrorNotice error={sendError} /> : null}
      {!confirming ? (
        <PayrollChunkProgress chunks={chunks} busy={busy} onRetry={(index) => void retryFrom(index)} />
      ) : null}
      {results.map((result) => (
        <SuccessNotice key={result.hash} hash={result.hash}>
          Paid {result.count} recipient{result.count === 1 ? "" : "s"}.
        </SuccessNotice>
      ))}
    </>
  );
}
