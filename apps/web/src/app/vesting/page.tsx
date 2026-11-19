"use client";

import { CreatePositionForm } from "@/components/CreatePositionForm";
import { EmptyState } from "@/components/Feedback";
import { GrantCard } from "@/components/GrantCard";
import { AddPositionForm, usePositions } from "@/components/PositionRegistry";

export default function VestingPage() {
  const positions = usePositions("vesting");

  return (
    <div className="stack">
      <div>
        <h1>Vesting</h1>
        <p className="muted page-intro">
          Nothing vests before the cliff. After it, vesting is linear until the
          schedule ends.
        </p>
      </div>

      {positions.length === 0 ? (
        <div className="card">
          <EmptyState title="No grants tracked yet">
            Initialize a deployed vesting contract below, or track one that already exists.
          </EmptyState>
        </div>
      ) : (
        positions.map((position) => (
          <GrantCard key={position.contractId} position={position} />
        ))
      )}

      <CreatePositionForm kind="vesting" />
      <AddPositionForm kind="vesting" noun="grant" />
    </div>
  );
}
