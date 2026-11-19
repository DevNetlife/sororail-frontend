// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GrantCard } from "../src/components/GrantCard";
import { READ_ONLY_REASON } from "../src/components/ReadOnly";
import { RPC_URL } from "../src/lib/network";
import type { Position } from "../src/lib/positions";

const GRANTOR = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const BENEFICIARY = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";

let walletAddress: string | null = BENEFICIARY;
let card: { data: Record<string, unknown> | null; loadError: unknown; isLoading: boolean };

vi.mock("@sororail/sdk", () => {
  class VestingClient {}
  class SigningError extends Error {}
  const formatAmount = (value: unknown) => String(value);
  return { VestingClient, SigningError, formatAmount };
});

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ address: walletAddress, signer: {} }),
}));

vi.mock("@/hooks/usePositionCard", () => ({
  usePositionCard: () => ({ ...card, client: {}, refresh: vi.fn() }),
}));

vi.mock("@/components/PositionRegistry", () => ({
  usePositionPolling: () => {},
  PositionHeader: () => <div>Grant card</div>,
}));

const position: Position = {
  kind: "vesting",
  contractId: "CB" + "B".repeat(54),
  label: "Grant card",
  addedAt: Date.now(),
  network: RPC_URL,
};

beforeEach(() => {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  walletAddress = BENEFICIARY;
  card = {
    data: {
      grantor: GRANTOR,
      beneficiary: BENEFICIARY,
      token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      total: 10_000n,
      start: nowSec - 100n,
      cliff: 1_000n,
      duration: 2_000n,
      revocable: true,
      claimed: 0n,
      returned: 0n,
      revokedAt: null,
    },
    loadError: null,
    isLoading: false,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GrantCard (#439)", () => {
  it("shows a grant before its cliff to the beneficiary", () => {
    render(<GrantCard position={position} />);
    expect(screen.getByText("Before cliff")).toBeInTheDocument();
    expect(screen.getByText("You receive")).toBeInTheDocument();
    expect(screen.getByText("Nothing vests until the cliff.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeDisabled();
  });

  it("reads the grant without a wallet and makes its actions read-only (#446)", () => {
    walletAddress = null;
    render(<GrantCard position={position} />);
    expect(screen.queryByText(/Connect a wallet to read/)).not.toBeInTheDocument();
    expect(screen.getByText("Before cliff")).toBeInTheDocument();
    expect(screen.getByText(READ_ONLY_REASON)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim" })).toBeDisabled();
  });

  it("refuses a position from a different network", () => {
    render(<GrantCard position={{ ...position, network: "https://other.example" }} />);
    expect(screen.getByText("Different network")).toBeInTheDocument();
  });

  it("marks a revoked grant and disables revoking again", () => {
    card.data = { ...card.data, revokedAt: 5n };
    walletAddress = GRANTOR;
    render(<GrantCard position={position} />);
    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.getByText("This grant has been revoked.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeDisabled();
  });
});
