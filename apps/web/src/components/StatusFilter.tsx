"use client";

import { useCallback, useState } from "react";

import {
  POSITION_STATUSES,
  STATUS_LABEL,
  countByStatus,
  type PositionStatus,
} from "@/lib/position-status";

/** Segmented control with a count per status (#428). Defaults to Active in `useStatusFilter`. */
export function StatusFilter({
  value,
  onChange,
  statuses,
  label = "Filter by status",
}: {
  value: PositionStatus;
  onChange: (next: PositionStatus) => void;
  statuses: Readonly<Record<string, PositionStatus>>;
  label?: string;
}) {
  const counts = countByStatus(statuses);
  return (
    <div className="row" role="group" aria-label={label}>
      {POSITION_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          className={status === value ? "button--primary" : undefined}
          aria-pressed={status === value}
          onClick={() => onChange(status)}
        >
          {STATUS_LABEL[status]} ({counts[status]})
        </button>
      ))}
    </div>
  );
}

/** Filter state for a list page plus the callback cards use to report their status once loaded. */
export function useStatusFilter(initial: PositionStatus = "active") {
  const [filter, setFilter] = useState<PositionStatus>(initial);
  const [statuses, setStatuses] = useState<Record<string, PositionStatus>>({});
  const report = useCallback((contractId: string, status: PositionStatus) => {
    setStatuses((prev) => (prev[contractId] === status ? prev : { ...prev, [contractId]: status }));
  }, []);
  return { filter, setFilter, statuses, report };
}
