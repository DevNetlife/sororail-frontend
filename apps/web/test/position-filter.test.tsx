// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PositionFilter, usePositionFilter } from "../src/components/PositionFilter";
import { filterPositions } from "../src/lib/position-filter";
import type { Position } from "../src/lib/positions";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

function position(label: string, contractId: string): Position {
  return { kind: "stream", contractId, label, addedAt: 0, network: "" };
}

const positions = [
  position("Salary for Ada", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADA"),
  position("Grant for Bayo", "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBXYZ"),
];

describe("filterPositions (#427)", () => {
  it("matches the label case-insensitively", () => {
    expect(filterPositions(positions, "ada").map((p) => p.label)).toEqual(["Salary for Ada"]);
  });

  it("matches a contract id substring", () => {
    expect(filterPositions(positions, "bxyz").map((p) => p.label)).toEqual(["Grant for Bayo"]);
  });

  it("returns nothing when no position matches", () => {
    expect(filterPositions(positions, "nobody")).toEqual([]);
  });

  it("returns every position for an empty or blank query", () => {
    expect(filterPositions(positions, "")).toBe(positions);
    expect(filterPositions(positions, "   ")).toBe(positions);
  });
});

describe("PositionFilter (#427)", () => {
  it("shows the match count and clears the query", () => {
    const onChange = vi.fn();
    render(<PositionFilter noun="stream" query="ada" onChange={onChange} shown={1} total={2} />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 2");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("hides the clear button and count when the query is empty", () => {
    render(<PositionFilter noun="stream" query="" onChange={vi.fn()} shown={2} total={2} />);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("usePositionFilter (#427)", () => {
  it("reads the query from the URL and writes changes back", () => {
    window.history.replaceState(null, "", "/streams?q=ada");
    const { result } = renderHook(() => usePositionFilter());
    expect(result.current[0]).toBe("ada");

    act(() => result.current[1]("bayo"));
    expect(result.current[0]).toBe("bayo");
    expect(new URLSearchParams(window.location.search).get("q")).toBe("bayo");

    act(() => result.current[1](""));
    expect(window.location.search).toBe("");
  });
});
