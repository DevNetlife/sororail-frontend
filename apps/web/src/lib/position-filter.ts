import type { Position } from "@/lib/positions";

/** URL search parameter that holds the position list filter (#427). */
export const POSITION_FILTER_PARAM = "q";

/** Positions whose label or contract id contains `query`, case-insensitively. An empty query matches everything. */
export function filterPositions(positions: Position[], query: string): Position[] {
  const q = query.trim().toLowerCase();
  if (!q) return positions;
  return positions.filter(
    (position) =>
      position.contractId.toLowerCase().includes(q) ||
      position.label.toLowerCase().includes(q),
  );
}
