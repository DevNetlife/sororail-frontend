// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatusFilter } from "../src/components/StatusFilter";
import {
  countByStatus,
  grantStatus,
  isVisible,
  streamStatus,
  type PositionStatus,
} from "../src/lib/position-status";

afterEach(() => cleanup());

const statuses: Record<string, PositionStatus> = {
  CA: "active",
  CB: "active",
  CC: "ended",
  CD: "cancelled",
};

describe("StatusFilter (#428)", () => {
  it.each([
    ["active", "Active (2)"],
    ["ended", "Ended (1)"],
    ["cancelled", "Cancelled (1)"],
  ] as const)("marks %s as pressed and shows its count", (status, label) => {
    render(<StatusFilter value={status} onChange={() => {}} statuses={statuses} />);
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    const others = screen.getAllByRole("button").filter((b) => b.textContent !== label);
    expect(others).toHaveLength(2);
    for (const other of others) expect(other).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the chosen status", async () => {
    const onChange = vi.fn();
    render(<StatusFilter value="active" onChange={onChange} statuses={statuses} />);
    await userEvent.click(screen.getByRole("button", { name: "Ended (1)" }));
    expect(onChange).toHaveBeenCalledWith("ended");
  });

  it("shows zero counts before any card has loaded", () => {
    render(<StatusFilter value="active" onChange={() => {}} statuses={{}} />);
    expect(screen.getByRole("button", { name: "Active (0)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelled (0)" })).toBeInTheDocument();
  });
});

describe("position status rules", () => {
  it("classifies streams", () => {
    expect(streamStatus({ stop: 100n, cancelledAt: null }, 50n)).toBe("active");
    expect(streamStatus({ stop: 100n, cancelledAt: null }, 100n)).toBe("ended");
    expect(streamStatus({ stop: 100n, cancelledAt: 60n }, 50n)).toBe("cancelled");
  });

  it("classifies grants (duration is a span from start)", () => {
    expect(grantStatus({ start: 10n, duration: 100n, revokedAt: null }, 50n)).toBe("active");
    expect(grantStatus({ start: 10n, duration: 100n, revokedAt: null }, 110n)).toBe("ended");
    expect(grantStatus({ start: 10n, duration: 100n, revokedAt: 40n }, 50n)).toBe("cancelled");
  });

  it("keeps cards with an unknown status visible under Active only", () => {
    expect(isVisible(undefined, "active")).toBe(true);
    expect(isVisible(undefined, "ended")).toBe(false);
    expect(isVisible("ended", "ended")).toBe(true);
    expect(isVisible("ended", "active")).toBe(false);
  });

  it("counts every bucket", () => {
    expect(countByStatus(statuses)).toEqual({ active: 2, ended: 1, cancelled: 1 });
  });
});
