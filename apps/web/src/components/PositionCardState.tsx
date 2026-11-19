import { ErrorNotice } from "./Feedback";
import { PositionHeader } from "./PositionRegistry";
import type { Position } from "@/lib/positions";

interface PositionCardStateProps {
  position: Position;
  /** Unused since #446: a position is readable without a wallet. Kept so callers need not change. */
  address?: string | null;
  loadError: unknown;
  isLoading: boolean;
  onRetry?: () => void | Promise<void>;
  noun: string;
  children: React.ReactNode;
}

export function PositionCardState({
  position,
  loadError,
  isLoading,
  onRetry,
  children,
}: PositionCardStateProps) {
  if (loadError) {
    return (
      <div className="card stack stack--tight">
        <PositionHeader position={position} />
        <ErrorNotice error={loadError} onRetry={onRetry} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card">
        <PositionHeader position={position} />
        <p className="small muted">Reading from the chain…</p>
      </div>
    );
  }

  return children;
}
