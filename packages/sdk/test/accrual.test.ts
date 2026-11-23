import { describe, expect, it } from "vitest";
import { accruedAt, vestedAt } from "../src/utils/accrual.js";
import type { Grant, Stream } from "../src/types/index.js";

describe("accruedAt", () => {
  const baseStream: Stream = {
    sender: "GAAA",
    recipient: "GBBB",
    token: "GCCC",
    ratePerSecond: 100n,
    start: 1000n,
    stop: 2000n,
    cancellable: false,
    deposited: 100000n,
    withdrawn: 0n,
    refunded: 0n,
    cancelledAt: null,
  };

  it("returns zero before start", () => {
    expect(accruedAt(baseStream, 500n)).toBe(0n);
  });

  it("accrues linearly during the stream", () => {
    expect(accruedAt(baseStream, 1500n)).toBe(50000n);
  });

  it("caps at deposited minus withdrawn", () => {
    expect(accruedAt(baseStream, 3000n)).toBe(100000n);
  });

  it("stops accruing after cancellation", () => {
    const cancelled = { ...baseStream, cancelledAt: 1500n };
    expect(accruedAt(cancelled, 2000n)).toBe(50000n);
  });

  it("accounts for already withdrawn amounts", () => {
    const withdrawn = { ...baseStream, withdrawn: 20000n };
    expect(accruedAt(withdrawn, 1500n)).toBe(50000n);
    expect(accruedAt(withdrawn, 3000n)).toBe(80000n);
  });
});

describe("vestedAt", () => {
  const baseGrant: Grant = {
    grantor: "GAAA",
    beneficiary: "GBBB",
    token: "GCCC",
    total: 100000n,
    start: 1000n,
    cliff: 100n,
    duration: 1000n,
    revocable: false,
    claimed: 0n,
    returned: 0n,
    revokedAt: null,
  };

  it("returns zero before cliff", () => {
    expect(vestedAt(baseGrant, 1050n)).toBe(0n);
  });

  it("vests linearly after cliff", () => {
    expect(vestedAt(baseGrant, 1550n)).toBe(50000n);
  });

  it("fully vests at duration", () => {
    expect(vestedAt(baseGrant, 2000n)).toBe(100000n);
  });

  it("stops vesting after revocation", () => {
    const revoked = { ...baseGrant, revokedAt: 1500n };
    expect(vestedAt(revoked, 2000n)).toBe(44444n);
  });

  it("accounts for claimed amounts", () => {
    const claimed = { ...baseGrant, claimed: 20000n };
    expect(vestedAt(claimed, 2000n)).toBe(80000n);
  });

  it("handles zero duration after cliff", () => {
    const instant = { ...baseGrant, duration: 100n };
    expect(vestedAt(instant, 1100n)).toBe(0n);
  });
});
