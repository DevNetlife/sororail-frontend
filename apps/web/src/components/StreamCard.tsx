"use client";

import { SigningError, StreamClient } from "@sororail/sdk";
import { useEffect, useState } from "react";

import { Confirm } from "@/components/Confirm";
import { ErrorNotice, SuccessNotice } from "@/components/Feedback";
import { Address, Money } from "@/components/Money";
import { usePositionPolling } from "@/components/PositionRegistry";
import { PositionDetails, PositionRefresh } from "@/components/PositionCardTools";
import { Figure, PositionCardShell } from "@/components/PositionCardShell";
import { ActionRow } from "@/components/ReadOnly";
import { AccrualChart } from "@/components/AccrualChart";
import { Schedule } from "@/components/Schedule";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { usePositionCard } from "@/hooks/usePositionCard";
import { streamStatus, type PositionStatus } from "@/lib/position-status";
import type { Position } from "@/lib/positions";
import { useWallet } from "@/lib/wallet";

/** One tracked stream: schedule, balances and its actions (moved from `streams/page.tsx`, #439). */
export function StreamCard({
  position,
  onStatus,
  hidden = false,
}: {
  position: Position;
  onStatus?: (contractId: string, status: PositionStatus) => void;
  hidden?: boolean;
}) {
  const { address, signer } = useWallet();
  const [available, setAvailable] = useState<bigint | null>(null);
  const [pending, setPending] = useState<"withdraw" | "cancel" | "topUp" | "extend" | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [extendDate, setExtendDate] = useState("");
  const [done, setDone] = useState<{ text: string; hash: string } | null>(null);
  const [now, setNow] = useState<bigint>(() => BigInt(Math.floor(Date.now() / 1000)));

  const { data: stream, loadError, client, refresh, isLoading, isRefreshing, lastUpdatedAt } = usePositionCard(
    StreamClient,
    position,
    address,
  );

  // Read balance separately after stream data loads
  useEffect(() => {
    if (!address || !stream) {
      setAvailable(null);
      return;
    }
  }, [client, address]);

  useEffect(() => { void refresh(); }, [refresh]);
  usePositionPolling(refresh);

  const status = stream ? streamStatus(stream, now) : undefined;
  useEffect(() => {
    if (status && onStatus) onStatus(position.contractId, status);
  }, [status, onStatus, position.contractId]);

  // Keep the clock moving so the schedule and accrual stay honest on screen.
  useEffect(() => {
    const id = setInterval(
      () => setNow(BigInt(Math.floor(Date.now() / 1000))),
      1_000,
    );
    return () => clearInterval(id);
  }, []);

  const {
    run,
    busy,
    error: actionError,
    reset: clearActionError,
  } = useAsyncAction(async (action: "withdraw" | "cancel" | "topUp" | "extend") => {
    if (!signer) {
      throw new SigningError("Wallet disconnected. Reconnect to continue.");
    }
    let call;
    let successText: string;
    if (action === "withdraw") {
      call = await client.withdraw();
      successText = "Withdrew accrued funds.";
    } else if (action === "cancel") {
      call = await client.cancel();
      successText = "Stream cancelled.";
    } else if (action === "topUp") {
      const stroops = BigInt(Math.round(parseFloat(topUpAmount) * 1e7));
      call = await client.topUp(stroops);
      successText = "Stream topped up.";
    } else {
      const ts = BigInt(Math.floor(new Date(extendDate).getTime() / 1000));
      call = await client.extend(ts);
      successText = "Stream end date extended.";
    }
    const sent = await call.signAndSend(signer);
    setDone({ text: successText, hash: sent.hash });
    setPending(null);
    setTopUpAmount("");
    setExtendDate("");
    await refresh();
  });

  if (hidden) return null;

  return (
    <PositionCardShell
      position={position}
      loadError={loadError}
      loading={isLoading || !stream}
      onRetry={refresh}
    >
      {() => {
        const s = stream!;
        const isRecipient = address === s.recipient;
        const isSender = address === s.sender;
        const ended = now >= s.stop;
        return (
          <>
            <PositionRefresh onRefresh={refresh} isRefreshing={isRefreshing} lastUpdatedAt={lastUpdatedAt} />
            <PositionDetails kind="stream" data={s} />

            <div className="row">
              {s.cancelledAt ? (
                <span className="pill pill--done">Cancelled</span>
              ) : ended ? (
                <span className="pill pill--done">Ended</span>
              ) : (
                <span className="pill pill--active">Streaming</span>
              )}
              {s.cancellable && !s.cancelledAt ? (
                <span className="pill">Cancellable</span>
              ) : null}
              {isRecipient ? <span className="pill">You receive</span> : null}
              {isSender ? <span className="pill">You send</span> : null}
            </div>

            <Schedule
              start={s.start}
              end={s.stop}
              now={now}
              {...(s.cancelledAt
                ? { marks: [{ at: s.cancelledAt, label: "cancelled" }] }
                : {})}
            />

            <AccrualChart
              start={s.start}
              stop={s.stop}
              now={now}
              deposited={s.deposited}
              ratePerSecond={s.ratePerSecond}
              withdrawn={s.withdrawn}
            />

            <div className="grid">
              <Figure label="Rate">
                <Money value={s.ratePerSecond} unit="XLM/s" />
              </Figure>
              <Figure label="Deposited">
                <Money value={s.deposited} />
              </Figure>
              <Figure label="Withdrawn">
                <Money value={s.withdrawn} direction="outgoing" />
              </Figure>
              <Figure label="Available to recipient">
                {available === null ? (
                  <span className="muted small">—</span>
                ) : (
                  /* Approximate: accrual continues between this read and any
                     transaction landing. */
                  <Money value={available} direction="incoming" approximate />
                )}
              </Figure>
            </div>

            <div className="small muted">
              <div>
                Sender <Address value={s.sender} />
              </div>
              <div>
                Recipient <Address value={s.recipient} />
              </div>
            </div>

            {done ? <SuccessNotice hash={done.hash}>{done.text}</SuccessNotice> : null}
            {actionError && !pending ? <ErrorNotice error={actionError} /> : null}

            <div className="stack stack--tight">
              <ActionRow readOnly={!address}>
                <button
                  type="button"
                  className="button--primary"
                  disabled={!isRecipient || available === null || available <= 0n}
                  aria-disabled={!isRecipient || available === null || available <= 0n}
                  onClick={() => setPending("withdraw")}
                >
                  Withdraw
                </button>
                <button
                  type="button"
                  disabled={Boolean(s.cancelledAt) || ended}
                  aria-disabled={Boolean(s.cancelledAt) || ended}
                  onClick={() => setPending("topUp")}
                >
                  Top up
                </button>
                <button
                  type="button"
                  disabled={Boolean(s.cancelledAt) || ended}
                  aria-disabled={Boolean(s.cancelledAt) || ended}
                  onClick={() => setPending("extend")}
                >
                  Extend
                </button>
                <button
                  type="button"
                  className="button--danger"
                  disabled={!isSender || !s.cancellable || Boolean(s.cancelledAt)}
                  aria-disabled={!isSender || !s.cancellable || Boolean(s.cancelledAt)}
                  onClick={() => setPending("cancel")}
                >
                  Cancel stream
                </button>
              </ActionRow>
              {(!isRecipient || available === null) && (
                <div className="small muted">
                  {!isRecipient && "Only the recipient can withdraw from a stream."}
                  {isRecipient && available === null && "Unable to read balance from chain."}
                </div>
              )}
              {(s.cancelledAt || ended) && (
                <div className="small muted">
                  {s.cancelledAt && "This stream has been cancelled."}
                  {!s.cancelledAt && ended && "This stream has already ended."}
                </div>
              )}
              {(!isSender || !s.cancellable || s.cancelledAt) && (
                <div className="small muted">
                  {!isSender && !s.cancellable && !s.cancelledAt && "Only the sender can cancel this stream, and it was created as non-cancellable."}
                  {!isSender && s.cancellable && !s.cancelledAt && "Only the sender can cancel this stream."}
                  {!s.cancellable && isSender && !s.cancelledAt && "This stream was created as non-cancellable."}
                  {s.cancelledAt && "This stream has been cancelled."}
                </div>
              )}
            </div>

            {pending === "withdraw" && available !== null ? (
              <Confirm
                title="Withdraw accrued funds"
                lines={[
                  { label: "To", value: <Address value={s.recipient} /> },
                  {
                    label: "Amount",
                    value: <Money value={available} approximate direction="incoming" />,
                  },
                  { label: "Contract", value: <Address value={position.contractId} /> },
                ]}
                irreversible={
                  "The transfer settles on chain and cannot be reversed. The exact amount may be slightly higher than shown, because the stream keeps accruing until the transaction lands."
                }
                confirmLabel="Withdraw"
                busy={busy}
                error={actionError ? <ErrorNotice error={actionError} /> : null}
                onConfirm={() => void run("withdraw")}
                onCancel={() => {
                  setPending(null);
                  clearActionError();
                }}
              />
            ) : null}

            {pending === "topUp" ? (
              <Confirm
                title="Top up this stream"
                lines={[
                  {
                    label: "Amount (XLM)",
                    value: (
                      <input
                        type="number"
                        min="0"
                        step="0.0000001"
                        placeholder="e.g. 10"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        className="input"
                      />
                    ),
                  },
                  { label: "Contract", value: <Address value={position.contractId} /> },
                ]}
                irreversible="Funds are transferred immediately from your account to the stream contract. The stop time advances by the span they buy at the current rate. The amount must be an exact multiple of the rate per second."
                confirmLabel="Top up"
                busy={busy}
                error={actionError ? <ErrorNotice error={actionError} /> : null}
                onConfirm={() => void run("topUp")}
                onCancel={() => {
                  setPending(null);
                  setTopUpAmount("");
                  clearActionError();
                }}
              />
            ) : null}

            {pending === "extend" ? (
              <Confirm
                title="Extend this stream"
                lines={[
                  {
                    label: "New end date",
                    value: (
                      <input
                        type="datetime-local"
                        value={extendDate}
                        onChange={(e) => setExtendDate(e.target.value)}
                        className="input"
                      />
                    ),
                  },
                  { label: "Contract", value: <Address value={position.contractId} /> },
                ]}
                irreversible="Funds covering the extra span are pulled from your account immediately. The new stop time must be later than the current one."
                confirmLabel="Extend"
                busy={busy}
                error={actionError ? <ErrorNotice error={actionError} /> : null}
                onConfirm={() => void run("extend")}
                onCancel={() => {
                  setPending(null);
                  setExtendDate("");
                  clearActionError();
                }}
              />
            ) : null}

            {pending === "cancel" ? (
              <Confirm
                title="Cancel this stream"
                danger
                lines={[
                  {
                    label: "Settles to recipient",
                    value: available ? <Money value={available} approximate /> : "—",
                  },
                  {
                    label: "Returns to you",
                    value: (
                      <Money
                        value={s.deposited - s.withdrawn - (available ?? 0n) > 0n
                          ? s.deposited - s.withdrawn - (available ?? 0n)
                          : 0n}
                        approximate
                      />
                    ),
                  },
                  { label: "Recipient", value: <Address value={s.recipient} /> },
                ]}
                irreversible={
                  "The stream stops permanently and cannot be restarted. Whatever has accrued is paid to the recipient immediately; the rest returns to you."
                }
                confirmLabel="Cancel stream"
                busy={busy}
                error={actionError ? <ErrorNotice error={actionError} /> : null}
                onConfirm={() => void run("cancel")}
                onCancel={() => {
                  setPending(null);
                  clearActionError();
                }}
              />
            ) : null}
          </>
        );
      }}
    </PositionCardShell>
  );
}
