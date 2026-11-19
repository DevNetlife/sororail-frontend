"use client";

import { SigningError, VestingClient } from "@sororail/sdk";
import { useCallback, useEffect, useState } from "react";

import { Confirm } from "@/components/Confirm";
import { ErrorNotice, SuccessNotice } from "@/components/Feedback";
import { Address, Money } from "@/components/Money";
import { usePositionPolling } from "@/components/PositionRegistry";
import { PositionDetails, PositionRefresh } from "@/components/PositionCardTools";
import { Figure, PositionCardShell } from "@/components/PositionCardShell";
import { Schedule } from "@/components/Schedule";
import { usePositionCard } from "@/hooks/usePositionCard";
import type { Position } from "@/lib/positions";
import { useWallet } from "@/lib/wallet";

/** One tracked vesting grant: schedule, balances and its actions (moved from `vesting/page.tsx`, #439). */
export function GrantCard({ position }: { position: Position }) {
  const { address, signer } = useWallet();
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [pending, setPending] = useState<"claim" | "revoke" | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ text: string; hash: string } | null>(null);
  const [now, setNow] = useState<bigint>(() => BigInt(Math.floor(Date.now() / 1000)));

  const { data: grant, loadError, client, refresh, isLoading, isRefreshing, lastUpdatedAt } = usePositionCard(
    VestingClient,
    position,
    address,
    useCallback(async (client: VestingClient, isCurrent?: () => boolean) => {
      try {
        const amount = await client.claimable();
        if (isCurrent && !isCurrent()) return;
        setClaimable(amount);
      } catch (error) {
        if (isCurrent && !isCurrent()) return;
        console.error("Failed to read claimable", error);
        setClaimable(null);
      }
    }, []),
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);
  usePositionPolling(refresh);

  useEffect(() => {
    const id = setInterval(
      () => setNow(BigInt(Math.floor(Date.now() / 1000))),
      1_000,
    );
    return () => clearInterval(id);
  }, []);

  async function run(action: "claim" | "revoke") {
    if (!signer) {
      setActionError(
        new SigningError("Wallet disconnected. Reconnect to continue."),
      );
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const call = action === "claim" ? await client.claim() : await client.revoke();
      const sent = await call.signAndSend(signer);
      setDone({
        text:
          action === "claim"
            ? "Claimed vested tokens."
            : "Grant revoked. The vested portion stays claimable.",
        hash: sent.hash,
      });
      setPending(null);
      await refresh();
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PositionCardShell
      position={position}
      address={address}
      loadError={loadError}
      loading={isLoading || !grant}
      onRetry={refresh}
      noun="grant"
    >
      {() => {
        const g = grant!;
        // cliff and duration are spans from start, not timestamps.
        const cliffAt = g.start + g.cliff;
        const endAt = g.start + g.duration;
        const isBeneficiary = address === g.beneficiary;
        const isGrantor = address === g.grantor;
        const beforeCliff = now < cliffAt;
        return (
          <>
            <PositionRefresh onRefresh={refresh} isRefreshing={isRefreshing} lastUpdatedAt={lastUpdatedAt} />
            <PositionDetails kind="vesting" data={g} />

            <div className="row">
              {g.revokedAt ? (
                <span className="pill pill--done">Revoked</span>
              ) : now >= endAt ? (
                <span className="pill pill--done">Fully vested</span>
              ) : beforeCliff ? (
                <span className="pill pill--warn">Before cliff</span>
              ) : (
                <span className="pill pill--active">Vesting</span>
              )}
              {g.revocable && !g.revokedAt ? (
                <span className="pill">Revocable</span>
              ) : null}
              {isBeneficiary ? <span className="pill">You receive</span> : null}
              {isGrantor ? <span className="pill">You granted</span> : null}
            </div>

            <Schedule
              start={g.start}
              end={endAt}
              now={now}
              marks={[
                { at: cliffAt, label: "cliff" },
                ...(g.revokedAt ? [{ at: g.revokedAt, label: "revoked" }] : []),
              ]}
            />

            <div className="grid">
              <Figure label="Total granted">
                <Money value={g.total} />
              </Figure>
              <Figure label="Claimed">
                <Money value={g.claimed} direction="outgoing" />
              </Figure>
              <Figure label="Claimable now">
                {claimable === null ? (
                  <span className="muted small">—</span>
                ) : (
                  <Money
                    value={claimable}
                    direction="incoming"
                    approximate={!g.revokedAt}
                  />
                )}
              </Figure>
              <Figure label="Returned to grantor">
                <Money value={g.returned} />
              </Figure>
            </div>

            <div className="small muted">
              <div>
                Grantor <Address value={g.grantor} />
              </div>
              <div>
                Beneficiary <Address value={g.beneficiary} />
              </div>
            </div>

            {done ? <SuccessNotice hash={done.hash}>{done.text}</SuccessNotice> : null}
            {actionError && !pending ? <ErrorNotice error={actionError} /> : null}

            <div className="stack stack--tight">
              <div className="row">
                <button
                  type="button"
                  className="button--primary"
                  disabled={!isBeneficiary || !claimable || claimable <= 0n}
                  aria-disabled={!isBeneficiary || !claimable || claimable <= 0n}
                  onClick={() => setPending("claim")}
                >
                  Claim
                </button>
                <button
                  type="button"
                  className="button--danger"
                  disabled={!isGrantor || !g.revocable || Boolean(g.revokedAt)}
                  aria-disabled={!isGrantor || !g.revocable || Boolean(g.revokedAt)}
                  onClick={() => setPending("revoke")}
                >
                  Revoke
                </button>
              </div>
              {(!isBeneficiary || beforeCliff) && (
                <div className="small muted">
                  {!isBeneficiary && "Only the beneficiary can claim."}
                  {isBeneficiary && beforeCliff && "Nothing vests until the cliff."}
                </div>
              )}
              {(!isGrantor || !g.revocable || g.revokedAt) && (
                <div className="small muted">
                  {!isGrantor && !g.revocable && !g.revokedAt && "Only the grantor can revoke, and this grant was created as non-revocable."}
                  {!isGrantor && g.revocable && !g.revokedAt && "Only the grantor can revoke."}
                  {!g.revocable && isGrantor && !g.revokedAt && "This grant was created as non-revocable."}
                  {g.revokedAt && "This grant has been revoked."}
                </div>
              )}
            </div>

            {pending === "claim" && claimable !== null ? (
              <Confirm
                title="Claim vested tokens"
                lines={[
                  { label: "To", value: <Address value={g.beneficiary} /> },
                  { label: "Amount", value: <Money value={claimable} approximate /> },
                ]}
                irreversible="The transfer settles on chain and cannot be reversed. The exact amount may be slightly higher than shown, because vesting continues until the transaction lands."
                confirmLabel="Claim"
                busy={busy}
                error={actionError ? <ErrorNotice error={actionError} /> : null}
                onConfirm={() => void run("claim")}
                onCancel={() => {
                  setPending(null);
                  setActionError(null);
                }}
              />
            ) : null}

            {pending === "revoke" ? (
              <Confirm
                title="Revoke this grant"
                danger
                lines={[
                  {
                    label: "Returns to you",
                    value: <Money value={g.total - g.claimed - (claimable ?? 0n) > 0n
                      ? g.total - g.claimed - (claimable ?? 0n)
                      : 0n} approximate />,
                  },
                  {
                    label: "Stays claimable by beneficiary",
                    value: claimable ? <Money value={claimable} approximate /> : "—",
                  },
                  { label: "Beneficiary", value: <Address value={g.beneficiary} /> },
                ]}
                irreversible="Vesting stops permanently and the grant cannot be restarted. Whatever has already vested stays in the contract and remains claimable by the beneficiary — only the unvested remainder comes back to you."
                confirmLabel="Revoke grant"
                busy={busy}
                error={actionError ? <ErrorNotice error={actionError} /> : null}
                onConfirm={() => void run("revoke")}
                onCancel={() => {
                  setPending(null);
                  setActionError(null);
                }}
              />
            ) : null}
          </>
        );
      }}
    </PositionCardShell>
  );
}
