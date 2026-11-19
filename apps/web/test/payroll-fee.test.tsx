// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Money } from "../src/components/Money";
import { PayrollFee } from "../src/components/PayrollFee";
import { INCLUSION_FEE_STROOPS, estimatePayrollFee } from "../src/lib/payroll-fee";

afterEach(cleanup);

/** Stub estimator: each chunk is a list of resource fees keyed by chunk name; "fail" rejects. */
function stub(fees: Record<string, bigint | "fail">) {
  return async (chunk: string) => {
    const fee = fees[chunk];
    if (fee === "fail" || fee === undefined) throw new Error(`simulation failed for ${chunk}`);
    return fee;
  };
}

function moneyText(value: bigint): string {
  const { container, unmount } = render(<Money value={value} />);
  const text = container.textContent ?? "";
  unmount();
  return text;
}

describe("estimatePayrollFee", () => {
  it("adds every chunk's simulated fee plus one inclusion fee per transaction", async () => {
    const estimate = await estimatePayrollFee(["a", "b", "c"], stub({ a: 1000n, b: 2000n, c: 500n }));
    expect(estimate).toEqual({ kind: "exact", total: 3500n + 3n * INCLUSION_FEE_STROOPS, transactions: 3 });
  });

  it("returns a range when some chunks cannot be simulated", async () => {
    const estimate = await estimatePayrollFee(["a", "b", "c"], stub({ a: 1000n, b: "fail", c: 3000n }));
    const a = 1000n + INCLUSION_FEE_STROOPS;
    const c = 3000n + INCLUSION_FEE_STROOPS;
    expect(estimate).toEqual({ kind: "range", min: a + c + a, max: a + c + c, transactions: 3, failed: 1 });
  });

  it("is unavailable when no chunk can be simulated", async () => {
    expect(await estimatePayrollFee(["a", "b"], stub({ a: "fail", b: "fail" }))).toEqual({
      kind: "unavailable",
      transactions: 2,
    });
  });

  it("is unavailable for an empty run", async () => {
    expect(await estimatePayrollFee([], stub({}))).toEqual({ kind: "unavailable", transactions: 0 });
  });
});

describe("PayrollFee", () => {
  it("shows the total for an exact estimate", async () => {
    const estimate = await estimatePayrollFee(["a", "b"], stub({ a: 1000n, b: 1000n }));
    if (estimate.kind !== "exact") throw new Error("expected an exact estimate");
    const expected = moneyText(estimate.total);
    render(<PayrollFee estimate={estimate} />);
    const text = screen.getByTestId("payroll-fee").textContent ?? "";
    expect(text).toContain("Estimated network fee");
    expect(text).toContain(expected);
    expect(text).toContain("2 transactions");
  });

  it("shows a range and how many chunks could not be simulated", async () => {
    const estimate = await estimatePayrollFee(["a", "b", "c"], stub({ a: 1000n, b: "fail", c: 3000n }));
    if (estimate.kind !== "range") throw new Error("expected a range estimate");
    const min = moneyText(estimate.min);
    const max = moneyText(estimate.max);
    render(<PayrollFee estimate={estimate} />);
    const text = screen.getByTestId("payroll-fee").textContent ?? "";
    expect(text).toContain(min);
    expect(text).toContain(max);
    expect(text).toContain("1 could not be simulated");
  });

  it("says when the fee could not be estimated", () => {
    render(<PayrollFee estimate={{ kind: "unavailable", transactions: 1 }} />);
    expect(screen.getByTestId("payroll-fee")).toHaveTextContent(
      "The network fee for 1 transaction could not be estimated.",
    );
  });
});
