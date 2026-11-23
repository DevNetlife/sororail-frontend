import { describe, expect, it } from "vitest";
import { splitBps } from "../src/utils/math.js";
import { ValidationError } from "../src/errors/index.js";

describe("splitBps", () => {
  it("rejects bps above 10,000", () => {
    expect(() => splitBps(1000n, 10_001)).toThrow(ValidationError);
    expect(() => splitBps(1000n, 15_000)).toThrow(ValidationError);
  });

  it("accepts bps at exactly 10,000", () => {
    const [high, low] = splitBps(1000n, 10_000);
    expect(high).toBe(1000n);
    expect(low).toBe(0n);
  });

  it("splits zero amount", () => {
    const [high, low] = splitBps(0n, 5000);
    expect(high).toBe(0n);
    expect(low).toBe(0n);
  });

  it("handles zero bps", () => {
    const [high, low] = splitBps(1000n, 0);
    expect(high).toBe(0n);
    expect(low).toBe(1000n);
  });

  it("calculates 50% split", () => {
    const [high, low] = splitBps(1000n, 5000);
    expect(high).toBe(500n);
    expect(low).toBe(500n);
  });

  it("calculates 25% split", () => {
    const [high, low] = splitBps(1000n, 2500);
    expect(high).toBe(250n);
    expect(low).toBe(750n);
  });

  it("calculates 2.5% split", () => {
    const [high, low] = splitBps(1000n, 250);
    expect(high).toBe(25n);
    expect(low).toBe(975n);
  });

  it("property: halves always sum to the amount", () => {
    const amounts = [
      1n,
      100n,
      999n,
      1000n,
      1001n,
      10_000n,
      123_456n,
      1_000_000n,
      BigInt(Number.MAX_SAFE_INTEGER),
    ];
    const bpsValues = [0, 1, 100, 1000, 2500, 5000, 7500, 9999, 10_000];

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const [high, low] = splitBps(amount, bps);
        expect(high + low).toBe(amount);
      }
    }
  });

  it("property: high is monotonically increasing with bps", () => {
    const amount = 10_000n;
    let previousHigh = 0n;

    for (let bps = 0; bps <= 10_000; bps += 100) {
      const [high] = splitBps(amount, bps);
      expect(high).toBeGreaterThanOrEqual(previousHigh);
      previousHigh = high;
    }
  });

  it("handles amounts that do not divide evenly", () => {
    const [high, low] = splitBps(1000n, 3333);
    expect(high).toBe(333n);
    expect(low).toBe(667n);
    expect(high + low).toBe(1000n);
  });

  it("matches expected rounding for typical escrow splits", () => {
    const [fee, depositor] = splitBps(10_000n, 250);
    expect(fee).toBe(250n);
    expect(depositor).toBe(9750n);

    const [beneficiary, refund] = splitBps(10_000n, 7500);
    expect(beneficiary).toBe(7500n);
    expect(refund).toBe(2500n);
  });
});
