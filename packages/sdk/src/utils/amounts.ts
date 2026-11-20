import { ValidationError } from "../errors/index.js";

/**
 * Decimal places for a classic Stellar asset and for the native XLM balance.
 *
 * **The decimals trap.** This is the default, not a guarantee. A custom
 * Soroban token can declare any number of decimals, and the contracts here
 * work in the token's smallest unit without knowing or caring which. Read
 * `decimals()` off the token contract rather than assuming 7 — getting this
 * wrong scales every amount by a factor of ten.
 */
export const STROOPS_DECIMALS = 7;

/**
 * Converts a human-readable decimal string to the token's smallest unit.
 *
 * Takes a **string**, not a number: `0.1 + 0.2 !== 0.3` in float, and a
 * payment amount is exactly the wrong place to discover that. Truncation is
 * refused rather than performed silently — an amount with more precision than
 * the token supports is a mistake worth surfacing.
 *
 * @example toStroops("1.5") === 15000000n
 */
export function toStroops(
  amount: string,
  decimals: number = STROOPS_DECIMALS,
): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38) {
    throw new ValidationError(`Invalid decimals: ${decimals}`);
  }
  // #75 — Strip thousands separators (commas) so spreadsheet exports and
  // human-pasted amounts like "1,234.50" work instead of failing with a
  // generic "not a valid decimal amount" error.
  const trimmed = amount.trim().replace(/,/g, "");
  if (!/^-?\d*(\.\d*)?$/.test(trimmed) || !/\d/.test(trimmed)) {
    throw new ValidationError(
      `"${amount}" is not a valid decimal amount. Use a plain string such as "12.50".`,
    );
  }

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole = "", fraction = ""] = unsigned.split(".");

  if (fraction.length > decimals) {
    const significant = fraction.slice(decimals).replace(/0+$/, "");
    if (significant.length > 0) {
      throw new ValidationError(
        `"${amount}" has more than ${decimals} decimal places, which this token cannot represent. Round it before converting rather than losing the remainder silently.`,
      );
    }
  }

  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const digits = `${whole || "0"}${padded}`;
  const value = BigInt(digits);
  return negative ? -value : value;
}

/**
 * Converts the token's smallest unit back to a decimal string.
 *
 * Returns a string rather than a number so that large balances survive the
 * trip: `Number` loses integer precision above 2^53. Keep arithmetic on
 * `bigint`-typed amount fields in `bigint`; `Number` conversion or arithmetic
 * on those fields should be flagged in review.
 *
 * @example fromStroops(15000000n) === "1.5"
 */
export function fromStroops(
  amount: bigint,
  decimals: number = STROOPS_DECIMALS,
): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38) {
    throw new ValidationError(`Invalid decimals: ${decimals}`);
  }
  if (decimals === 0) return amount.toString();

  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  const body = fraction.length > 0 ? `${whole}.${fraction}` : whole;
  return negative ? `-${body}` : body;
}

/**
 * Formats an amount for display, keeping the token's full precision but
 * grouping the whole part so long figures stay readable in a table.
 *
 * @param amount - The raw amount in smallest units (bigint)
 * @param options - Formatting options including custom decimals and locale
 * @returns A locale-formatted decimal string
 * @example formatAmount(12345678900000n) === "1,234,567.89"
 */
export function formatAmount(
  amount: bigint,
  options: { decimals?: number; locale?: string } = {},
): string {
  const { decimals = STROOPS_DECIMALS, locale = "en-US" } = options;
  const plain = fromStroops(amount, decimals);
  const negative = plain.startsWith("-");
  const unsigned = negative ? plain.slice(1) : plain;
  const [whole = "0", fraction] = unsigned.split(".");
  const grouped = BigInt(whole).toLocaleString(locale);
  const body = fraction ? `${grouped}.${fraction}` : grouped;
  return negative ? `-${body}` : body;
}

/**
 * Parses a user-typed amount string using the grouping and decimal separators
 * of the given locale and returns a strict decimal string suitable for
 * {@link toStroops}.
 *
 * Where `toStroops` only accepts plain `"1234.5"`-style strings (intentionally
 * strict to prevent silent mistakes), this function is lenient: it strips
 * locale-appropriate grouping characters, normalises the decimal character to
 * `.`, and returns a canonical string.
 *
 * **Ambiguous input** (e.g. `"1,234"`) is resolved by the locale: in `en-US`
 * the comma is a grouping separator so `"1,234"` → `"1234"`; in `de-DE` the
 * comma is the decimal separator so `"1,234"` → `"1.234"`.
 *
 * Space-like separators (regular space, non-breaking space ` `, narrow
 * no-break space ` `) are all accepted when the locale uses any of them
 * as the grouping character — so `"1 234,5"` and `"1 234,5"` are
 * equivalent for `fr-FR`.
 *
 * @param input  - User-typed string, e.g. `"1.234,5"` for de-DE
 * @param locale - BCP-47 locale tag, defaults to `"en-US"`
 * @returns A strict decimal string ready for {@link toStroops}
 * @throws {ValidationError} When the input cannot be parsed as a number in the given locale
 *
 * @example
 * parseAmountInput("1,234.50", "en-US") // → "1234.50"
 * parseAmountInput("1.234,5",  "de-DE") // → "1234.5"
 * parseAmountInput("1 234,5",  "fr-FR") // → "1234.5"
 */
export function parseAmountInput(input: string, locale = "en-US"): string {
  let groupSep: string;
  let decimalSep: string;
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1_234_567.89);
    groupSep = parts.find((p) => p.type === "group")?.value ?? "";
    decimalSep = parts.find((p) => p.type === "decimal")?.value ?? ".";
  } catch {
    throw new ValidationError(`"${locale}" is not a recognised locale tag.`);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError(`Amount cannot be empty.`);
  }

  // Strip grouping separators.  Space-like separators in the locale
  // (narrow no-break space, non-breaking space, regular space) are treated
  // interchangeably so hand-typed spaces work even when Intl emits  .
  let normalised = trimmed;
  if (groupSep) {
    if (/[\s  ]/.test(groupSep)) {
      normalised = normalised.replace(/[\s  ]/g, "");
    } else {
      const escaped = groupSep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      normalised = normalised.replace(new RegExp(escaped, "g"), "");
    }
  }

  // Normalise the decimal separator to ".".
  if (decimalSep !== ".") {
    const escapedDec = decimalSep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const decCount = (normalised.match(new RegExp(escapedDec, "g")) ?? []).length;
    if (decCount > 1) {
      throw new ValidationError(
        `"${input}" contains more than one "${decimalSep}" separator. ` +
          `Use a plain decimal string such as "12.50".`,
      );
    }
    normalised = normalised.replace(new RegExp(escapedDec), ".");
  }

  // Validate that the result is a well-formed decimal string.
  if (!/^-?\d*(\.\d*)?$/.test(normalised) || !/\d/.test(normalised)) {
    throw new ValidationError(
      `"${input}" could not be parsed as a ${locale} amount. ` +
        `Use a plain decimal string such as "12.50".`,
    );
  }

  return normalised;
}

/**
 * Asserts an amount is strictly positive (> 0n), as every contract requires.
 *
 * @param amount - The amount to validate
 * @param label - Descriptive label for the amount field used in the error message
 * @throws {ValidationError} When the amount is zero or negative
 * @example requirePositive(100n, "deposit") // passes
 * @example requirePositive(0n, "deposit") // throws ValidationError("The deposit must be greater than zero.")
 */
export function requirePositive(amount: bigint, label = "amount"): void {
  if (amount <= 0n) {
    throw new ValidationError(`The ${label} must be greater than zero.`);
  }
}
