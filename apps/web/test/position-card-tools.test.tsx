// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PositionDetails,
  PositionRefresh,
  formatUpdatedAgo,
  toDisplayJson,
} from "../src/components/PositionCardTools";
import type { PositionKind } from "../src/lib/positions";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const G = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
const C = "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

const structs: Record<PositionKind, Record<string, unknown>> = {
  stream: {
    sender: G, recipient: G, token: C, ratePerSecond: 10n, start: 1_700_000_000n, stop: 1_800_000_000n,
    cancellable: true, deposited: 1_000_000_000n, withdrawn: 0n, refunded: 0n, cancelledAt: null,
  },
  vesting: {
    grantor: G, beneficiary: G, token: C, total: 9_007_199_254_740_993n, start: 1_700_000_000n, cliff: 0n,
    duration: 31_536_000n, revocable: false, claimed: 0n, returned: 0n, revokedAt: null,
  },
  escrow: { depositor: G, beneficiary: G, arbiter: null, token: C, amount: 5_000_000n, deadline: 1_750_000_000n, state: "Funded" },
};

describe("PositionDetails (#425)", () => {
  it.each(Object.keys(structs) as PositionKind[])("renders the raw %s struct with bigint as strings", (kind) => {
    render(<PositionDetails kind={kind} data={structs[kind]} />);
    const details = screen.getByTestId(`position-details-${kind}`);
    expect(details.tagName).toBe("DETAILS");
    expect(screen.getByText("Raw on-chain data")).toBeInTheDocument();
    const json = JSON.parse(details.querySelector("pre")?.textContent ?? "") as Record<string, unknown>;
    for (const [key, value] of Object.entries(structs[kind])) {
      expect(json[key]).toEqual(typeof value === "bigint" ? value.toString() : value);
    }
  });

  it("keeps bigint precision beyond Number.MAX_SAFE_INTEGER", () => {
    expect(toDisplayJson({ total: 9_007_199_254_740_993n })).toContain('"9007199254740993"');
  });

  it("copies the JSON to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<PositionDetails kind="escrow" data={structs.escrow} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    });
    expect(writeText).toHaveBeenCalledWith(toDisplayJson(structs.escrow));
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });
});

describe("PositionRefresh (#426)", () => {
  it("formats the relative label", () => {
    expect(formatUpdatedAgo(null, 0)).toBe("Not read yet");
    expect(formatUpdatedAgo(1_000, 6_500)).toBe("Updated 5 s ago");
    expect(formatUpdatedAgo(0, 125_000)).toBe("Updated 2 min ago");
    expect(formatUpdatedAgo(0, 2 * 3_600_000)).toBe("Updated 2 h ago");
  });

  it("calls refresh on click", () => {
    const onRefresh = vi.fn();
    render(<PositionRefresh onRefresh={onRefresh} isRefreshing={false} lastUpdatedAt={Date.now()} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("is disabled while a read is in flight", () => {
    render(<PositionRefresh onRefresh={vi.fn()} isRefreshing lastUpdatedAt={Date.now()} />);
    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
  });

  it("updates the label as time passes and resets after a refresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const start = Date.now();
    const { rerender } = render(<PositionRefresh onRefresh={vi.fn()} isRefreshing={false} lastUpdatedAt={start} />);
    expect(screen.getByTestId("position-updated")).toHaveTextContent("Updated 0 s ago");
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByTestId("position-updated")).toHaveTextContent("Updated 3 s ago");
    rerender(<PositionRefresh onRefresh={vi.fn()} isRefreshing={false} lastUpdatedAt={Date.now()} />);
    expect(screen.getByTestId("position-updated")).toHaveTextContent("Updated 0 s ago");
  });
});
