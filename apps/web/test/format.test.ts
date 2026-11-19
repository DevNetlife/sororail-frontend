import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatTokenAmount } from "../src/lib/format";

// #410 — every amount and date goes through lib/format, in the viewer's locale and one timezone policy.
const LOCALES = [
  { locale: "en-US", grouping: ",", decimal: "." },
  { locale: "de-DE", grouping: ".", decimal: "," },
] as const;

describe.each(LOCALES)("formatTokenAmount in $locale", ({ locale, grouping, decimal }) => {
  it("groups thousands and uses the locale's decimal separator", () => {
    // 1,234,567.5 with 7 decimals
    expect(formatTokenAmount(12_345_675_000_000n, 7, locale)).toBe(`1${grouping}234${grouping}567${decimal}5`);
  });

  it("keeps every significant fraction digit exactly (no floating point)", () => {
    expect(formatTokenAmount(1n, 7, locale)).toBe(`0${decimal}0000001`);
  });

  it("respects the token's decimals", () => {
    expect(formatTokenAmount(1_500_000n, 6, locale)).toBe(`1${decimal}5`);
    expect(formatTokenAmount(42n, 0, locale)).toBe("42");
  });

  it("formats negatives and zero", () => {
    expect(formatTokenAmount(-25_000_000n, 7, locale)).toBe(`-2${decimal}5`);
    expect(formatTokenAmount(0n, 7, locale)).toBe("0");
  });
});

describe.each(LOCALES)("dates in $locale", ({ locale }) => {
  const at = 1_767_225_600n; // 2026-01-01T00:00:00Z

  it("formats in the given timezone, not a fixed one", () => {
    const utc = formatDate(at, { locale, timeZone: "UTC" });
    const lagos = formatDate(at - 1n, { locale, timeZone: "Africa/Lagos" });
    const ny = formatDate(at, { locale, timeZone: "America/New_York" });
    expect(utc).toContain("2026");
    expect(lagos).toContain("2026"); // 00:59:59 on 1 Jan in Lagos (UTC+1)
    expect(ny).toContain("2025"); // still 31 Dec in New York
  });

  it("matches Intl for the same locale and zone (one policy everywhere)", () => {
    const expected = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(Number(at) * 1000));
    expect(formatDateTime(at, { locale, timeZone: "UTC" })).toBe(expected);
  });

  it("does not wrap modern timestamps (no modulo arithmetic)", () => {
    expect(formatDate(at, { locale, timeZone: "UTC" })).not.toContain("1992");
  });
});
