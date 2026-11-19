/**
 * English UI strings (#409). English is the only locale for now; a new locale
 * is a sibling file with the same keys, registered in `./index.ts`.
 *
 * Pilot: the Overview page. Other pages still have inline copy and move here
 * as they are touched.
 */
export const en = {
  "overview.title": "Overview",
  "overview.intro":
    "A reference application for the SoroRail payment contracts. Everything shown here is read from the chain.",
  "overview.tile.payroll.title": "Payroll",
  "overview.tile.payroll.body": "Pay many recipients in one transaction.",
  "overview.tile.streams.title": "Streams",
  "overview.tile.streams.body": "Continuous per-second transfer. Withdraw, top up, extend or cancel.",
  "overview.tile.vesting.title": "Vesting",
  "overview.tile.vesting.body": "Scheduled release with a cliff. Claim what has vested, or revoke.",
  "overview.tile.escrow.title": "Escrow",
  "overview.tile.escrow.body": "Funds held until a condition is met, with an optional arbiter.",
  "overview.positions.title": "How this app finds your positions",
  "overview.positions.p1":
    "Each escrow, stream and grant is its own deployed contract, holding exactly one position for its whole life. There is no on-chain index tying them to your account, so this app keeps a list of addresses you have told it about, in this browser only.",
  "overview.positions.p2":
    "That list is a convenience, not a record. Every balance and state you see is read from the contract itself, and removing an address from the list changes nothing on chain.",
  "overview.positions.batchPrefix": "is the exception — it is stateless, so one shared deployment serves everybody:",
  "overview.notBuilt.title": "Not yet built",
  "overview.notBuilt.detail":
    "The indexer, unified history feed and CSV export described in the spec are not implemented. There is no database and no backend — this app is entirely client-side against Soroban RPC.",
} as const;

export type MessageKey = keyof typeof en;
