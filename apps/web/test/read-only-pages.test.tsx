// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EscrowPage from "../src/app/escrow/page";
import StreamsPage from "../src/app/streams/page";
import VestingPage from "../src/app/vesting/page";
import { READ_ONLY_REASON } from "../src/components/ReadOnly";
import { RPC_URL } from "../src/lib/network";
import type { Position, PositionKind } from "../src/lib/positions";

// #446: every position page renders its data with no wallet at all, and every
// action is disabled with the reason shown.

const A = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const B = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";
const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const now = () => BigInt(Math.floor(Date.now() / 1000));

let kind: PositionKind = "stream";
const position = (): Position => ({
  kind,
  contractId: "CA" + "A".repeat(54),
  label: `Tracked ${kind}`,
  addedAt: Date.now(),
  network: RPC_URL,
});

const data = (): unknown => {
  if (kind === "stream") {
    return { sender: A, recipient: B, ratePerSecond: 1n, deposited: 1_000n, withdrawn: 0n, start: 0n, stop: 9_999_999_999n, cancellable: true, cancelledAt: null };
  }
  if (kind === "vesting") {
    return { grantor: A, beneficiary: B, token: TOKEN, total: 10_000n, start: now() - 1_000n, cliff: 500n, duration: 2_000n, revocable: true, claimed: 0n, returned: 0n, revokedAt: null };
  }
  return { depositor: A, beneficiary: B, arbiter: null, token: TOKEN, amount: 1_000_000_000n, deadline: now() + 100_000n, state: "Funded" };
};

vi.mock("@sororail/sdk", () => {
  class StreamClient {}
  class VestingClient {}
  class EscrowClient {}
  class SigningError extends Error {}
  const formatAmount = (value: unknown) => String(value);
  const isTerminalEscrowState = (state: string) => ["Released", "Refunded", "Resolved"].includes(state);
  return { StreamClient, VestingClient, EscrowClient, SigningError, formatAmount, isTerminalEscrowState };
});

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ address: null, signer: null }),
}));

vi.mock("@/hooks/usePositionCard", () => ({
  usePositionCard: () => ({
    data: data(),
    loadError: null,
    client: {},
    refresh: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/components/PositionRegistry", () => ({
  usePositions: () => [position()],
  usePositionPolling: () => {},
  AddPositionForm: () => null,
  PositionHeader: ({ position: p }: { position: Position }) => <div>{p.label}</div>,
}));

vi.mock("@/components/CreatePositionForm", () => ({
  CreatePositionForm: () => null,
}));

afterEach(() => {
  cleanup();
});

describe("read-only mode without a wallet (#446)", () => {
  it.each([
    ["stream", StreamsPage, "Deposited", ["Withdraw", "Top up", "Extend", "Cancel stream"]],
    ["vesting", VestingPage, "Total granted", ["Claim", "Revoke"]],
    ["escrow", EscrowPage, "Amount", ["Fund", "Release", "Refund"]],
  ] as const)("the %s page shows chain data and disables every action", (k, Page, figure, actions) => {
    kind = k;
    render(<Page />);

    expect(screen.getAllByText(`Tracked ${k}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(figure).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Connect a wallet to read/)).not.toBeInTheDocument();
    expect(screen.getByText(READ_ONLY_REASON)).toBeInTheDocument();
    for (const name of actions) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
