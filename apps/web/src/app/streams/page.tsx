"use client";

import { useEffect, useState } from "react";

import { CardSkeleton } from "@/components/CardSkeleton";
import { CreatePositionForm } from "@/components/CreatePositionForm";
import { EmptyState } from "@/components/Feedback";
import { AddPositionForm, usePositions } from "@/components/PositionRegistry";
import { StreamCard } from "@/components/StreamCard";

export default function StreamsPage() {
  const positions = usePositions("stream");
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
      ) : positions.length === 0 ? (
        <div className="card">
          <EmptyState title="No streams tracked yet">
            Initialize a deployed stream contract below, or track one that already exists.
          </EmptyState>
        </div>
      ) : (
        positions.map((position) => (
          <StreamCard key={position.contractId} position={position} />
        ))
      )}

      <CreatePositionForm kind="stream" />
      <AddPositionForm kind="stream" noun="stream" />
    </div>
  );
}
