// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAYROLL_DRAFT_DELAY_MS, PAYROLL_DRAFT_KEY, usePayrollDraft } from "../src/lib/payrollDraft";

describe("usePayrollDraft (#421)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("saves the CSV only after the debounce delay", () => {
    const { rerender } = renderHook(({ csv }) => usePayrollDraft(csv), { initialProps: { csv: "" } });
    rerender({ csv: "GABC,1" });
    rerender({ csv: "GABC,12" });
    act(() => vi.advanceTimersByTime(PAYROLL_DRAFT_DELAY_MS - 1));
    expect(window.localStorage.getItem(PAYROLL_DRAFT_KEY)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(window.localStorage.getItem(PAYROLL_DRAFT_KEY)).toBe("GABC,12");
  });

  it("offers a saved draft on load and does not wipe it while the textarea is still empty", () => {
    window.localStorage.setItem(PAYROLL_DRAFT_KEY, "GABC,5");
    const { result } = renderHook(() => usePayrollDraft(""));
    expect(result.current.savedDraft).toBe("GABC,5");
    act(() => vi.advanceTimersByTime(PAYROLL_DRAFT_DELAY_MS * 2));
    expect(window.localStorage.getItem(PAYROLL_DRAFT_KEY)).toBe("GABC,5");
  });

  it("clears the draft, e.g. after a successful run", () => {
    window.localStorage.setItem(PAYROLL_DRAFT_KEY, "GABC,5");
    const { result } = renderHook(() => usePayrollDraft(""));
    act(() => result.current.clear());
    expect(result.current.savedDraft).toBeNull();
    expect(window.localStorage.getItem(PAYROLL_DRAFT_KEY)).toBeNull();
  });

  it("removes the draft once a CSV that had content is emptied", () => {
    const { rerender } = renderHook(({ csv }) => usePayrollDraft(csv), { initialProps: { csv: "GABC,1" } });
    act(() => vi.advanceTimersByTime(PAYROLL_DRAFT_DELAY_MS));
    expect(window.localStorage.getItem(PAYROLL_DRAFT_KEY)).toBe("GABC,1");
    rerender({ csv: "" });
    act(() => vi.advanceTimersByTime(PAYROLL_DRAFT_DELAY_MS));
    expect(window.localStorage.getItem(PAYROLL_DRAFT_KEY)).toBeNull();
  });

  it("keeps working when localStorage throws on every call", () => {
    const boom = () => {
      throw new DOMException("denied", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);

    const { result, rerender } = renderHook(({ csv }) => usePayrollDraft(csv), { initialProps: { csv: "" } });
    expect(result.current.savedDraft).toBeNull();
    rerender({ csv: "GABC,1" });
    expect(() => act(() => vi.advanceTimersByTime(PAYROLL_DRAFT_DELAY_MS))).not.toThrow();
    expect(() => act(() => result.current.clear())).not.toThrow();
  });
});
