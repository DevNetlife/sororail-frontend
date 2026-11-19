import { formatTokenAmount } from "@/lib/format";

/**
 * The estimated network fee shown in the Confirm dialog (#399).
 *
 * The estimate is the simulation's resource fee, in stroops, plus nothing else:
 * it is a `bigint` from the simulation all the way to the display string. Only
 * `describeNetworkFee` turns it into text, through the shared formatter.
 */
export type NetworkFeeState =
  | { status: "loading" }
  | { status: "ready"; stroops: bigint }
  | { status: "unavailable" };

/** Stellar amounts have 7 decimal places (1 XLM = 10^7 stroops). */
const XLM_DECIMALS = 7;

/**
 * The text for the fee line. A failed estimate reads as a neutral sentence and
 * never shows the underlying error, so no raw code reaches the user.
 */
export function describeNetworkFee(fee: NetworkFeeState, locale?: string): string {
  switch (fee.status) {
    case "loading":
      return "Estimating…";
    case "ready":
      return `${formatTokenAmount(fee.stroops, XLM_DECIMALS, locale)} XLM`;
    case "unavailable":
      return "Fee unavailable";
  }
}
