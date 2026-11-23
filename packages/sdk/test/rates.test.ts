import { describe, expect, it } from "vitest";

import { ratePerSecond } from "../src/utils/rates.js";
import { ValidationError } from "../src/errors/index.js";

describe("ratePerSecond", () => {
  it("computes exact division with no remainder", () => {
    const result = ratePerSecond(3600n, 3600n);
    expect(result.rate).toBe(1n);
    expect(result.remainder).toBe(0n);
  });

  it("returns remainder when division is not exact", () => {
    const result = ratePerSecond(1000n, 3n);
    expect(result.rate).toBe(333n);
    expect(result.remainder).toBe(1n);
    expect(result.rate * 3n + result.remainder).toBe(1000n);
  });

  it("handles large amounts per period", () => {
    const monthlyPayment = 10_000_000_000n;
    const thirtyDays = 30n * 24n * 3600n;
    const result = ratePerSecond(monthlyPayment, thirtyDays);
    expect(result.rate).toBe(3858n);
    expect(result.remainder).toBe(64000n);
  });

  it("throws when the rate would be zero", () => {
    expect(() => ratePerSecond(1n, 100n)).toThrow(ValidationError);
    expect(() => ratePerSecond(99n, 100n)).toThrow(ValidationError);
  });

  it("allows zero amount explicitly", () => {
    const result = ratePerSecond(0n, 3600n);
    expect(result.rate).toBe(0n);
    expect(result.remainder).toBe(0n);
  });

  it("throws for negative amounts", () => {
    expect(() => ratePerSecond(-100n, 3600n)).toThrow(ValidationError);
  });

  it("throws for zero or negative period", () => {
    expect(() => ratePerSecond(1000n, 0n)).toThrow(ValidationError);
    expect(() => ratePerSecond(1000n, -3600n)).toThrow(ValidationError);
  });

  it("handles tiny amounts that yield a valid rate", () => {
    const result = ratePerSecond(100n, 10n);
    expect(result.rate).toBe(10n);
    expect(result.remainder).toBe(0n);
  });
});
