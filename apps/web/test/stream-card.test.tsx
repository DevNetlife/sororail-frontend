// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StreamCard } from "../src/components/StreamCard";
import { READ_ONLY_REASON } from "../src/components/ReadOnly";
import { RPC_URL } from "../src/lib/network";
import type { Position } from "../src/lib/positions";

const SENDER = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const RECIPIENT = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";

let walletAddress: string | null = RECIPIENT;
let card: { data: Record<string, unknown> | null; loadError: unknown; isLoading: boolean };

vi.mock("@sororail/sdk", () => {
  class StreamClient {}
  class SigningError extends Error {}
  return { StreamClient, SigningError };
});

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ address: walletAddress, signer: {} }),
}));

vi.mock("@/hooks/usePositionCard", () => ({
  usePositionCard: () => ({ ...card, client: {}, refresh: vi.fn() }),
}));

vi.mock("@/components/PositionRegistry", () => ({
  usePositionPolling: () => {},
  PositionHeader: () => <div>Stream card</div>,
}));

const position: Position = {
  kind: "stream",
  contractId: "CA" + "A".repeat(54),
  label: "Stream card",
  addedAt: Date.now(),
  network: RPC_URL,
};

beforeEach(() => {
  walletAddress = RECIPIENT;
  card = {
    data: {
      sender: SENDER,
      recipient: RECIPIENT,
      ratePerSecond: 1n,
      deposited: 1_000n,
      withdrawn: 0n,
      start: 0n,
      stop: 9_999_999_999n,
      cancellable: true,
      cancelledAt: null,
    },
    loadError: null,
    isLoading: false,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StreamCard (#439)", () => {
  it("renders a live stream with its status and the recipient's view", () => {
    render(<StreamCard position={position} />);
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByText("You receive")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel stream" })).toBeDisabled();
  });

  it("reads the stream without a wallet and makes its actions read-only (#446)", () => {
    walletAddress = null;
    render(<StreamCard position={position} />);
    expect(screen.queryByText(/Connect a wallet to read/)).not.toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByText(READ_ONLY_REASON)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("refuses a position from a different network", () => {
    render(<StreamCard position={{ ...position, network: "https://other.example" }} />);
    expect(screen.getByText("Different network")).toBeInTheDocument();
    expect(screen.queryByText("Streaming")).not.toBeInTheDocument();
  });

  it("shows a skeleton while the stream is loading", () => {
    card = { data: null, loadError: null, isLoading: true };
    render(<StreamCard position={position} />);
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
    expect(screen.queryByText("Streaming")).not.toBeInTheDocument();
  });

  it("marks a cancelled stream and disables its actions", () => {
    card.data = { ...card.data, cancelledAt: 10n };
    render(<StreamCard position={position} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Top up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Extend" })).toBeDisabled();
  });
});
