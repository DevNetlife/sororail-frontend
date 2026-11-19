/**
 * Network fee estimate for a multi-chunk payroll run (#424).
 *
 * Each chunk is its own transaction, so the run costs the sum of every chunk's
 * simulated resource fee plus one inclusion fee per transaction. When some
 * chunks cannot be simulated, the estimate becomes a range: the known chunks
 * exactly, and each unknown chunk somewhere between the cheapest and the most
 * expensive chunk that did simulate (chunks are the same size apart from the
 * last, so they cost about the same).
 */

/** Stellar's base inclusion fee per transaction, in stroops (`BASE_FEE` in stellar-sdk). */
export const INCLUSION_FEE_STROOPS = 100n;

export type PayrollFeeEstimate =
  | { kind: "exact"; total: bigint; transactions: number }
  | { kind: "range"; min: bigint; max: bigint; transactions: number; failed: number }
  | { kind: "unavailable"; transactions: number };

export async function estimatePayrollFee<Chunk>(
  chunks: readonly Chunk[],
  estimateChunk: (chunk: Chunk) => Promise<bigint>,
): Promise<PayrollFeeEstimate> {
  const known: bigint[] = [];
  let failed = 0;
  for (const chunk of chunks) {
    try {
      known.push((await estimateChunk(chunk)) + INCLUSION_FEE_STROOPS);
    } catch {
      failed += 1;
    }
  }

  const transactions = chunks.length;
  if (known.length === 0) return { kind: "unavailable", transactions };

  const sum = known.reduce((total, fee) => total + fee, 0n);
  if (failed === 0) return { kind: "exact", total: sum, transactions };

  const cheapest = known.reduce((a, b) => (b < a ? b : a));
  const dearest = known.reduce((a, b) => (b > a ? b : a));
  return {
    kind: "range",
    min: sum + cheapest * BigInt(failed),
    max: sum + dearest * BigInt(failed),
    transactions,
    failed,
  };
}
