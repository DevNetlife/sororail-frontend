"use client";

import type { ReactNode } from "react";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorNotice } from "@/components/Feedback";
import { PositionHeader } from "@/components/PositionRegistry";
import type { Position } from "@/lib/positions";
import { RPC_URL } from "@/lib/network";

/**
 * The shell every position card shares (#439): the other-network, no-wallet,
 * load-error and loading states, then the loaded card with its header. The
 * loaded body is a render function so it only runs once the data exists.
 */
export function PositionCardShell({
  position,
  address,
  loadError,
  loading,
  onRetry,
  noun,
  children,
}: {
  position: Position;
  address: string | null;
  loadError: unknown;
  loading: boolean;
  onRetry: () => void | Promise<void>;
  noun: string;
  children: () => ReactNode;
}) {
  if (position.network && position.network !== RPC_URL) {
    return (
      <div className="card stack stack--tight">
        <PositionHeader position={position} />
        <div className="notice notice--warn">
          <div className="notice__title">Different network</div>
          <div className="notice__detail">
            This position is from a different network.
          </div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="card">
        <PositionHeader position={position} />
        <p className="small muted">Connect a wallet to read this {noun}.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card stack stack--tight">
        <PositionHeader position={position} />
        <ErrorNotice error={loadError} onRetry={onRetry} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <PositionHeader position={position} />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="card stack stack--tight">
      <PositionHeader position={position} />
      {children()}
    </div>
  );
}

/** A labelled value in a card's figure grid. */
export function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{children}</div>
    </div>
  );
}
