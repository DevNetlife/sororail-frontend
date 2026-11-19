import {
  BatchPayoutClient,
  ValidationError,
  fromStroops,
  toStroops,
  type Payment,
} from "@sororail/sdk";

/** The scale `toStroops` assumes when the token's decimals are not known yet. */
const DEFAULT_DECIMALS = 7;

/** Significant decimal places in a typed amount; trailing zeros do not count ("1.50" has 1). */
export function decimalPlaces(amount: string): number {
  const fraction = amount.trim().replace(/,/g, "").split(".")[1] ?? "";
  return fraction.replace(/0+$/, "").length;
}

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

export function parseCsv(text: string, decimals?: number): ParsedLine[] {
  return text
    .split("\n")
    .map((raw, index) => ({ raw: raw.trim(), index }))
    .filter(({ raw }) => raw.length > 0 && !raw.startsWith("#"))
    .map(({ raw, index }): ParsedLine => {
      const parts = splitCsvLine(raw);
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
      // Name the token's limit per row instead of leaving the precision loss to
      // whichever conversion path the amount takes later (#423).
      const allowed = decimals ?? DEFAULT_DECIMALS;
      if (decimalPlaces(amount) > allowed) {
        return {
          line,
          to,
          amount,
          error: `Amount has too many decimal places (maximum ${allowed}).`,
        };
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

export interface MergedAddress {
  to: string;
  /** Source line numbers that were combined, the first of which now holds the sum. */
  lines: number[];
  /** The combined amount as written back into the CSV. */
  amount: string;
}

/**
 * Combines valid rows that pay the same address into one row on the first
 * occurrence, summing their amounts (#420). Comments, blank lines and rows with
 * errors are left exactly as they were, so nothing the operator still has to
 * fix is hidden by the merge.
 */
export function mergeDuplicateRows(
  text: string,
  decimals?: number,
): { text: string; merged: MergedAddress[] } {
  const scale = decimals ?? DEFAULT_DECIMALS;
  const groups = new Map<string, ParsedLine[]>();
  for (const line of parseCsv(text, decimals)) {
    if (line.error || line.stroops === undefined) continue;
    groups.set(line.to, [...(groups.get(line.to) ?? []), line]);
  }

  const replace = new Map<number, string>();
  const drop = new Set<number>();
  const merged: MergedAddress[] = [];
  for (const [to, lines] of groups) {
    if (lines.length < 2) continue;
    const total = lines.reduce((sum, line) => sum + line.stroops!, 0n);
    const amount = fromStroops(total, scale);
    replace.set(lines[0]!.line, `${to},${amount}`);
    for (const line of lines.slice(1)) drop.add(line.line);
    merged.push({ to, lines: lines.map((line) => line.line), amount });
  }
  if (merged.length === 0) return { text, merged };

  const out = text
    .split("\n")
    .flatMap((raw, index) => {
      const line = index + 1;
      if (drop.has(line)) return [];
      return [replace.get(line) ?? raw];
    })
    .join("\n");
  return { text: out, merged };
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
