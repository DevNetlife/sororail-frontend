// @vitest-environment jsdom
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Confirm } from "../src/components/Confirm";
import { useNetworkFee } from "../src/hooks/useNetworkFee";
import { describeNetworkFee } from "../src/lib/network-fee";

function renderWithFee(fee: Parameters<typeof Confirm>[0]["fee"]) {
  return render(
    <Confirm
      title="Release escrow"
      lines={[{ label: "Amount", value: "10 XLM" }]}
      irreversible="The release cannot be reversed."
      confirmLabel="Release"
      fee={fee}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("describeNetworkFee", () => {
  it("converts stroops to XLM with integer arithmetic", () => {
    expect(describeNetworkFee({ status: "ready", stroops: 1234567n }, "en-US")).toBe("0.1234567 XLM");
    expect(describeNetworkFee({ status: "ready", stroops: 10_000_000n }, "en-US")).toBe("1 XLM");
  });

  it("shows neutral text while loading and when unavailable", () => {
    expect(describeNetworkFee({ status: "loading" })).toBe("Estimating…");
    expect(describeNetworkFee({ status: "unavailable" })).toBe("Fee unavailable");
  });
});

describe("Confirm network fee line (#399)", () => {
  it("reserves the fee line while the estimate is loading", () => {
    renderWithFee({ status: "loading" });

    const line = screen.getByTestId("confirm-network-fee");
    expect(line).toHaveTextContent("Estimated network fee");
    expect(line).toHaveTextContent("Estimating…");
  });

  it("shows the stubbed estimate in XLM", () => {
    renderWithFee({ status: "ready", stroops: 1234567n });

    expect(screen.getByTestId("confirm-network-fee")).toHaveTextContent("0.1234567 XLM");
  });

  it("falls back to a neutral message when estimation fails, without a raw error", () => {
    renderWithFee({ status: "unavailable" });

    const line = screen.getByTestId("confirm-network-fee");
    expect(line).toHaveTextContent("Fee unavailable");
    expect(line.textContent).not.toMatch(/error|Error|simulat|Contract|#\d/);
  });

  it("omits the fee line when no estimate is passed", () => {
    renderWithFee(undefined);

    expect(screen.queryByTestId("confirm-network-fee")).toBeNull();
  });
});

describe("useNetworkFee", () => {
  it("resolves a stubbed estimate to ready", async () => {
    const estimate = vi.fn(async () => 500n);
    const { result } = renderHook(() => useNetworkFee("release", estimate));

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "ready", stroops: 500n }));
    expect(estimate).toHaveBeenCalledTimes(1);
  });

  it("falls back to unavailable when the estimate rejects", async () => {
    const estimate = vi.fn(async () => {
      throw new Error("simulation failed: HostError #7");
    });
    const { result } = renderHook(() => useNetworkFee("refund", estimate));

    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
  });

  it("does not re-estimate on re-render with the same key", async () => {
    const estimate = vi.fn(async () => 1n);
    const { result, rerender } = renderHook(() => useNetworkFee("dispute", estimate));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender();
    expect(estimate).toHaveBeenCalledTimes(1);
  });
});
