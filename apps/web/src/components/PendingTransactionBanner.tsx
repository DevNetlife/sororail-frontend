import type { PendingTransactionStatus } from "@/hooks/usePendingTransaction";

interface PendingTransactionBannerProps {
  status: PendingTransactionStatus;
  hash?: string;
  elapsedSeconds: number;
  onDismiss: () => void;
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/** Persistent status for a transaction between signature and ledger inclusion (#398). */
export function PendingTransactionBanner({
  status,
  hash,
  elapsedSeconds,
  onDismiss,
}: PendingTransactionBannerProps) {
  if (status === "idle") return null;

  const copy = COPY[status];
  const elapsed = formatElapsed(elapsedSeconds);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`notice ${copy.className}`}
      data-status={status}
    >
      <div className="notice__title">{copy.title}</div>
      <div className="notice__detail">
        {copy.detail(elapsed)}
        {hash ? (
          <>
            {" "}
            Hash: <code>{hash}</code>
          </>
        ) : null}
      </div>
      <div className="row">
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

const COPY: Record<
  Exclude<PendingTransactionStatus, "idle">,
  { title: string; detail: (elapsed: string) => string; className: string }
> = {
  pending: {
    title: "Transaction pending",
    detail: (elapsed) => `Waiting for the network to confirm your transaction. Elapsed ${elapsed}.`,
    className: "notice--info",
  },
  timeout: {
    title: "Still waiting for confirmation",
    detail: (elapsed) =>
      `No confirmation after ${elapsed}. It may still succeed, so check the hash before retrying to avoid paying twice.`,
    className: "notice--warn",
  },
  success: {
    title: "Transaction confirmed",
    detail: () => "The network included your transaction.",
    className: "notice--info",
  },
};
