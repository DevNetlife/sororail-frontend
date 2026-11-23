import { describe, expect, it } from "vitest";

import {
  toUnixSeconds,
  fromUnixSeconds,
  seconds,
  minutes,
  hours,
  days,
  weeks,
} from "../src/utils/time.js";
import { ValidationError } from "../src/errors/index.js";

describe("toUnixSeconds", () => {
  it("converts Date to bigint unix seconds", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    expect(toUnixSeconds(date)).toBe(1704067200n);
  });

  it("rounds down sub-second precision", () => {
    const date = new Date("2024-01-01T00:00:00.999Z");
    expect(toUnixSeconds(date)).toBe(1704067200n);
  });

  it("handles dates far in the past and future", () => {
    const past = new Date("1970-01-01T00:00:00.000Z");
    expect(toUnixSeconds(past)).toBe(0n);

    const future = new Date("2100-01-01T00:00:00.000Z");
    expect(toUnixSeconds(future)).toBe(4102444800n);
  });
});

describe("fromUnixSeconds", () => {
  it("converts bigint unix seconds to Date", () => {
    const date = fromUnixSeconds(1704067200n);
    expect(date.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  it("round-trips", () => {
    const original = new Date("2024-06-15T12:30:45.123Z");
    const ts = toUnixSeconds(original);
    const restored = fromUnixSeconds(ts);
    expect(Math.floor(restored.getTime() / 1000)).toBe(
      Math.floor(original.getTime() / 1000),
    );
  });

  it("rejects negative timestamps", () => {
    expect(() => fromUnixSeconds(-1n)).toThrow(ValidationError);
  });

  it("rejects timestamps beyond MAX_SAFE_INTEGER", () => {
    const tooBig = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => fromUnixSeconds(tooBig)).toThrow(ValidationError);
  });

  it("handles bigint boundaries within safe range", () => {
    const nearMax = BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1000));
    expect(() => fromUnixSeconds(nearMax)).not.toThrow();
  });
});

describe("time unit constants", () => {
  it("defines correct second values", () => {
    expect(seconds).toBe(1n);
    expect(minutes).toBe(60n);
    expect(hours).toBe(3600n);
    expect(days).toBe(86400n);
    expect(weeks).toBe(604800n);
  });

  it("composes naturally for duration arithmetic", () => {
    expect(30n * days).toBe(2592000n);
    expect(2n * weeks + 3n * days).toBe(1468800n);
    expect(1n * hours + 30n * minutes).toBe(5400n);
  });
});
