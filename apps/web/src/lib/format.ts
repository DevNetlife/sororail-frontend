import { fromStroops } from "@sororail/sdk";

/**
 * The one place amounts and dates are formatted (#410), so a page never mixes a
 * fixed `en-US` figure with a browser-locale date.
 *
 * Locale: the browser's `navigator.language`, falling back to `en-US` during
 * server rendering and in non-browser tests.
 *
 * Timezone policy: every date shows in the viewer's own timezone, resolved once
 * from `Intl` and passed explicitly to every formatter, so two dates on the
 * same page can never disagree about which zone they are in.
 */

export const DEFAULT_LOCALE = "en-US";

export function getLocale(): string {
  return typeof navigator !== "undefined" && navigator.language
    ? navigator.language
    : DEFAULT_LOCALE;
}

export function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface FormatOptions {
  locale?: string;
  timeZone?: string;
}

function decimalSeparator(locale: string): string {
  return (
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? "."
  );
}

/**
 * A token amount in its smallest unit, rendered with the locale's grouping and
 * decimal separator. The digits come from integer arithmetic (`fromStroops`), so
 * no precision is lost to floating point; only the separators are localised.
 */
export function formatTokenAmount(
  amount: bigint,
  decimals = 7,
  locale: string = getLocale(),
): string {
  const plain = fromStroops(amount, decimals);
  const negative = plain.startsWith("-");
  const [whole = "0", fraction] = (negative ? plain.slice(1) : plain).split(".");
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    BigInt(whole),
  );
  const body = fraction ? `${grouped}${decimalSeparator(locale)}${fraction}` : grouped;
  return negative ? `-${body}` : body;
}

const toDate = (seconds: bigint): Date => new Date(Number(seconds) * 1000);

/** A ledger timestamp (seconds) as a calendar date, e.g. "12 Mar 2026". */
export function formatDate(seconds: bigint, options: FormatOptions = {}): string {
  return new Intl.DateTimeFormat(options.locale ?? getLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: options.timeZone ?? getTimeZone(),
  }).format(toDate(seconds));
}

/** A ledger timestamp (seconds) as a date and time. */
export function formatDateTime(seconds: bigint, options: FormatOptions = {}): string {
  return new Intl.DateTimeFormat(options.locale ?? getLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: options.timeZone ?? getTimeZone(),
  }).format(toDate(seconds));
}
