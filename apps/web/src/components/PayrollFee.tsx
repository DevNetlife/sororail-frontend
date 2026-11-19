import { Money } from "@/components/Money";
import type { PayrollFeeEstimate } from "@/lib/payroll-fee";

/** Shows the estimated network fee for a payroll run in the preview (#424). */
export function PayrollFee({ estimate }: { estimate: PayrollFeeEstimate }) {
  const plural = estimate.transactions === 1 ? "" : "s";

  if (estimate.kind === "unavailable") {
    return (
      <p className="small muted m-0" data-testid="payroll-fee">
        The network fee for {estimate.transactions} transaction{plural} could not be estimated.
      </p>
    );
  }

  if (estimate.kind === "range") {
    return (
      <p className="small muted m-0" data-testid="payroll-fee">
        Estimated network fee: <Money value={estimate.min} /> to <Money value={estimate.max} /> across{" "}
        {estimate.transactions} transaction{plural} ({estimate.failed} could not be simulated, so their
        cost is estimated from the others).
      </p>
    );
  }

  return (
    <p className="small muted m-0" data-testid="payroll-fee">
      Estimated network fee: <Money value={estimate.total} /> across {estimate.transactions} transaction
      {plural}.
    </p>
  );
}
