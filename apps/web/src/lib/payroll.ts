import {
  BatchPayoutClient,
  ValidationError,
  toStroops,
  type Payment,
} from "@sororail/sdk";

export interface ParsedLine {
  line: number;
  to: string;
  amount: string;
  stroops?: bigint;
  error?: string;
}

/** Returns `null` until the contract cap is known, so callers cannot send unsplit payments. */
export function splitPayrollPayments(
  payments: readonly Payment[],
  maxRecipients: number | null,
): Payment[][] | null {
  return maxRecipients === null
    ? null
    : BatchPayoutClient.chunk(payments, maxRecipients);
}

export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      i++;
      continue;
    }

    current += char;
    i++;
  }

  fields.push(current.trim());
  return fields;
}

const HEADER_ADDRESS_NAMES = new Set(["address", "account", "recipient", "to", "wallet"]);
const HEADER_AMOUNT_NAMES = new Set(["amount", "value", "payout"]);

/**
 * Spreadsheets paste as tab-separated values; a line with tabs and no commas
 * is split on tabs, everything else is parsed as CSV.
 */
function splitRow(raw: string): string[] {
  if (raw.includes("\t") && !raw.includes(",")) {
    return raw.split("\t").map((field) => field.trim());
  }
  return splitCsvLine(raw);
}

/** True for a header such as `address,amount` (names are case-insensitive). */
export function isHeaderRow(parts: readonly string[]): boolean {
  const address = (parts[0] ?? "").trim().toLowerCase();
  const amount = (parts[1] ?? "").trim().toLowerCase();
  return HEADER_ADDRESS_NAMES.has(address) && HEADER_AMOUNT_NAMES.has(amount);
}

/** The CSV a user downloads as a starting point. Comment lines are ignored on upload. */
export function buildPayrollTemplate(): string {
  return [
    "address,amount",
    "# One recipient per line. Lines starting with # are ignored.",
    "# G...,12.50",
    "",
  ].join("\n");
}

export function parseCsv(text: string, decimals?: number): ParsedLine[] {
  const rows = text
    .split("\n")
    .map((raw, index) => ({ raw: raw.trim(), index }))
    .filter(({ raw }) => raw.length > 0 && !raw.startsWith("#"));
  // A header row is not a recipient. Only the first row can be one.
  const body =
    rows.length > 0 && isHeaderRow(splitRow(rows[0].raw)) ? rows.slice(1) : rows;
  return body
    .map(({ raw, index }): ParsedLine => {
      const parts = splitRow(raw);
      const line = index + 1;

      if (parts.length > 2) {
        return {
          line,
          to: parts[0] || "",
          amount: parts[1] || "",
          error: `Row has ${parts.length} columns; expected 2 (address,amount)`,
        };
      }

      const [to = "", amount = ""] = parts;

      if (!/^G[A-Z2-7]{55}$/.test(to)) {
        return { line, to, amount, error: "Not a valid account address (G…)" };
      }
      try {
        const stroops = toStroops(amount, decimals);
        if (stroops <= 0n) {
          return { line, to, amount, error: "Amount must be greater than zero" };
        }
        return { line, to, amount, stroops };
      } catch (error) {
        return {
          line,
          to,
          amount,
          error: error instanceof ValidationError ? error.message : "Invalid amount",
        };
      }
    });
}

/** Removes successfully paid source rows while preserving comments and errors. */
export function removeCsvLines(
  text: string,
  lineNumbers: Iterable<number>,
): string {
  const removed = new Set(lineNumbers);
  return text
    .split("\n")
    .filter((_, index) => !removed.has(index + 1))
    .join("\n");
}
