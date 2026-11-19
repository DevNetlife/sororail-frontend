"use client";

import { useEffect, useState } from "react";

import { CardSkeleton } from "@/components/CardSkeleton";
import { CreatePositionForm } from "@/components/CreatePositionForm";
import { EmptyState } from "@/components/Feedback";
import { AddPositionForm, usePositions } from "@/components/PositionRegistry";
import { PositionFilter, usePositionFilter } from "@/components/PositionFilter";
import { StatusFilter, useStatusFilter } from "@/components/StatusFilter";
import { StreamCard } from "@/components/StreamCard";
import { filterPositions } from "@/lib/position-filter";
import { isVisible } from "@/lib/position-status";

export default function StreamsPage() {
  const allPositions = usePositions("stream");
  const [query, setQuery] = usePositionFilter();
  const positions = filterPositions(allPositions, query);
  const { filter, setFilter, statuses, report } = useStatusFilter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return (
    <div className="stack">
      <div>
        <h1>Streams</h1>
        <p className="muted page-intro">
          Continuous per-second transfer. Accrual is computed from ledger time,
          so a balance rises without any transaction being sent.
        </p>
      </div>

      {!hydrated ? (
        Array.from({ length: 3 }, (_, index) => (
          <div className="card" key={`stream-skeleton-${index}`}>
            <CardSkeleton label="Loading streams" />
          </div>
        ))
      ) : allPositions.length === 0 ? (
        <div className="card">
          <EmptyState title="No streams tracked yet">
            Initialize a deployed stream contract below, or track one that already exists.
          </EmptyState>
        </div>
      ) : (
        <>
          <PositionFilter noun="stream" query={query} onChange={setQuery} shown={positions.length} total={allPositions.length}>
            <StatusFilter value={filter} onChange={setFilter} statuses={statuses} label="Filter streams by status" />
          </PositionFilter>
          {positions.length === 0 ? (
            <div className="card">
              <EmptyState title="No streams match">Try a different name or address, or clear the search.</EmptyState>
            </div>
          ) : (
            positions.map((position) => (
              <StreamCard
                key={position.contractId}
                position={position}
                onStatus={report}
                hidden={!isVisible(statuses[position.contractId], filter)}
              />
            ))
          )}
        </>
      )}

      <CreatePositionForm kind="stream" />
      <AddPositionForm kind="stream" noun="stream" />
    </div>
  );
}
