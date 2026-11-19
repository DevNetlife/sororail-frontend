"use client";

import { Address, Money } from "@/components/Money";
import { MAX_VISIBLE_VALID_ROWS, type PayrollState } from "@/hooks/usePayroll";

type PreviewProps = Pick<
  PayrollState,
  | "address"
  | "parsed"
  | "visible"
  | "hiddenValidCount"
  | "duplicates"
  | "decimals"
  | "decimalsError"
  | "cap"
  | "capError"
  | "payments"
  | "batches"
>;

/** The parsed recipients table and the notices about them (#438). */
export function PayrollPreview({
  address,
  parsed,
  visible,
  hiddenValidCount,
  duplicates,
  decimals,
  decimalsError,
  cap,
  capError,
  payments,
  batches,
}: PreviewProps) {
  return (
    <>
      {parsed.length > 0 ? (
        <div className="table-scroll">
          <table aria-describedby="recipients-heading">
            <thead>
              <tr>
                <th>Line</th>
                <th>Recipient</th>
                <th className="numeric">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((line) => (
                <tr key={line.line}>
                  <td className="muted">{line.line}</td>
                  <td>
                    {line.to ? (
                      <Address value={line.to} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="numeric">
                    {line.error ? (
                      <span className="muted">{line.amount || "—"}</span>
                    ) : (
                      <Money value={line.stroops!} decimals={decimals ?? undefined} />
                    )}
                  </td>
                  <td>
                    {line.error ? (
                      <span className="text-danger">{line.error}</span>
                    ) : (
                      <span className="muted">ok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {hiddenValidCount > 0 ? (
        <div className="notice notice--info">
          <div className="notice__title">
            {hiddenValidCount} more valid row{hiddenValidCount === 1 ? "" : "s"} not shown
          </div>
          <div className="notice__detail">
            Only the first {MAX_VISIBLE_VALID_ROWS} valid rows are rendered.
            They are still included in the total and in what gets paid — any
            row with an error is always shown, no matter how many there are.
          </div>
        </div>
      ) : null}

      {duplicates.length > 0 ? (
        <div className="notice notice--warn">
          <div className="notice__title">
            {duplicates.length} address
            {duplicates.length === 1 ? " appears" : "es appear"} more than once
          </div>
          <div className="notice__detail">
            That is allowed — the contract does not reject duplicates, and two
            lines for one contractor is a normal thing to want. Check it is
            deliberate before sending.
          </div>
        </div>
      ) : null}

      {decimalsError ? (
        <div className="notice notice--warn">
          <div className="notice__title">
            Could not read the token&apos;s decimals
          </div>
          <div className="notice__detail">
            Amounts are scaled by the token&apos;s decimals, so payouts stay
            disabled until they can be read. Check the network and the
            configured token, then reconnect.
          </div>
        </div>
      ) : null}

      {capError ? (
        <div className="notice notice--warn">
          <div className="notice__title">
            Could not verify the maximum recipients per batch
          </div>
          <div className="notice__detail">
            The batch cap could not be determined (network issue, contract not
            found, or RPC error). Payouts are disabled to prevent submitting a
            batch the contract may reject. Check the network and reload to try
            again.
          </div>
        </div>
      ) : null}

      {address && cap === null && !capError ? (
        <div className="notice notice--info">
          <div className="notice__title">Checking the contract batch limit</div>
          <div className="notice__detail">
            Payouts stay disabled until the maximum recipients per transaction
            is verified.
          </div>
        </div>
      ) : null}

      {cap !== null && payments.length > cap ? (
        <div className="notice notice--info">
          <div className="notice__title">
            This will be sent as {batches?.length ?? 0} transactions
          </div>
          <div className="notice__detail">
            The contract accepts at most {cap} recipients per batch, so the
            payroll is split. Each batch is all-or-nothing on its own — an
            earlier batch stays paid if a later one fails.
          </div>
        </div>
      ) : null}
    </>
  );
}
