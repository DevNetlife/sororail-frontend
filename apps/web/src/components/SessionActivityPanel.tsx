"use client";

import { useEffect, useSyncExternalStore } from "react";

import { explorerTx } from "@/lib/network";
import { useRpc } from "@/lib/rpc-provider";
import {
  sessionActivity,
  type SessionActivityStore,
  type SessionTxStatus,
  type TxStatusSource,
} from "@/lib/session-activity";

const STATUS_LABEL: Record<SessionTxStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  failed: "Failed",
};

/**
 * Lists the transactions submitted in this session, newest first, with a
 * block explorer link once a hash is known. While any pending transaction has
 * a hash, its status is polled through the RPC server.
 */
export function SessionActivityPanel({
  store = sessionActivity,
  source,
  pollMs = 5_000,
}: {
  store?: SessionActivityStore;
  /** Overrides the app RPC for status checks (tests). */
  source?: TxStatusSource;
  pollMs?: number;
}) {
  const rpc = useRpc();
  const server: TxStatusSource = source ?? rpc.server;
  const entries = useSyncExternalStore(store.subscribe, store.list, store.list);
  const hasPendingHash = entries.some((entry) => entry.status === "pending" && entry.hash !== null);

  useEffect(() => {
    if (!hasPendingHash) return;
    const tick = () => {
      void store.refreshPending(server);
    };
    tick();
    const id = setInterval(tick, pollMs);
    return () => clearInterval(id);
  }, [hasPendingHash, store, server, pollMs]);

  return (
    <section className="card stack stack--tight" aria-labelledby="session-activity-heading">
      <h2 id="session-activity-heading">Session activity</h2>
      {entries.length === 0 ? (
        <p className="muted">No transactions submitted in this session yet.</p>
      ) : (
        <ul className="stack stack--tight" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {entries.map((entry) => {
            const href = entry.hash ? explorerTx(entry.hash) : null;
            const short = entry.hash ? `${entry.hash.slice(0, 8)}…` : null;
            return (
              <li key={entry.id} className="row">
                <span>{entry.label}</span>{" "}
                <span data-status={entry.status}>{STATUS_LABEL[entry.status]}</span>{" "}
                <time dateTime={new Date(entry.submittedAt).toISOString()}>
                  {new Date(entry.submittedAt).toLocaleTimeString()}
                </time>{" "}
                {short && href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" title={entry.hash ?? undefined}>
                    {short}
                    <span className="sr-only"> (opens block explorer)</span>
                  </a>
                ) : short ? (
                  <code title={entry.hash ?? undefined}>{short}</code>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
