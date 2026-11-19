"use client";

import { CreatePositionForm } from "@/components/CreatePositionForm";
import { EmptyState } from "@/components/Feedback";
import { GrantCard } from "@/components/GrantCard";
import { filterPositions } from "@/lib/position-filter";
import { AddPositionForm, usePositions } from "@/components/PositionRegistry";
import { PositionFilter, usePositionFilter } from "@/components/PositionFilter";
import { StatusFilter, useStatusFilter } from "@/components/StatusFilter";
import { isVisible } from "@/lib/position-status";

export default function VestingPage() {
  const allPositions = usePositions("vesting");
  const [query, setQuery] = usePositionFilter();
  const positions = filterPositions(allPositions, query);
  const { filter, setFilter, statuses, report } = useStatusFilter();

  return (
    <div className="stack">
      <div>
        <h1>Vesting</h1>
        <p className="muted page-intro">
          Nothing vests before the cliff. After it, vesting is linear until the
          schedule ends.
        </p>
      </div>

      {allPositions.length === 0 ? (
        <div className="card">
          <EmptyState title="No grants tracked yet">
            Initialize a deployed vesting contract below, or track one that already exists.
          </EmptyState>
        </div>
      ) : (
        <>
          <PositionFilter noun="grant" query={query} onChange={setQuery} shown={positions.length} total={allPositions.length}>
            <StatusFilter value={filter} onChange={setFilter} statuses={statuses} label="Filter grants by status" />
          </PositionFilter>
          {positions.length === 0 ? (
            <div className="card">
              <EmptyState title="No grants match">Try a different name or address, or clear the search.</EmptyState>
            </div>
          ) : (
            positions.map((position) => (
              <GrantCard
                key={position.contractId}
                position={position}
                onStatus={report}
                hidden={!isVisible(statuses[position.contractId], filter)}
              />
            ))
          )}
        </>
      )}

      <CreatePositionForm kind="vesting" />
      <AddPositionForm kind="vesting" noun="grant" />
    </div>
  );
}
