import { scValToNative, xdr } from "@stellar/stellar-sdk";
import type { ContractName } from "../errors/index.js";

export interface RawEvent {
  type: string;
  contractId?: string;
  topics: xdr.ScVal[];
  data: xdr.ScVal;
}

type EscrowEvent =
  | { type: "Initialized"; depositor: string; beneficiary: string; arbiter: string | null; token: string; amount: bigint; deadline: bigint }
  | { type: "Funded"; amount: bigint }
  | { type: "Released"; beneficiary: string; amount: bigint }
  | { type: "Refunded"; depositor: string; amount: bigint }
  | { type: "Disputed"; caller: string }
  | { type: "Resolved"; beneficiaryAmount: bigint; depositorAmount: bigint };

type StreamEvent =
  | { type: "StreamCreated"; id: bigint; sender: string; recipient: string; token: string; ratePerSecond: bigint; startsAt: bigint; endsAt: bigint }
  | { type: "StreamWithdrawn"; id: bigint; recipient: string; amount: bigint }
  | { type: "StreamCancelled"; id: bigint; sender: string; remainingBalance: bigint }
  | { type: "StreamPaused"; id: bigint }
  | { type: "StreamResumed"; id: bigint };

type VestingEvent =
  | { type: "VestingCreated"; id: bigint; beneficiary: string; token: string; totalAmount: bigint; startTime: bigint; cliffTime: bigint; endTime: bigint }
  | { type: "VestingClaimed"; id: bigint; beneficiary: string; amount: bigint }
  | { type: "VestingRevoked"; id: bigint; unvestedAmount: bigint };

type RecurringEvent =
  | { type: "SubscriptionCreated"; id: bigint; subscriber: string; recipient: string; token: string; amount: bigint; interval: bigint }
  | { type: "PaymentProcessed"; id: bigint; amount: bigint; timestamp: bigint }
  | { type: "SubscriptionCancelled"; id: bigint; timestamp: bigint };

type BatchPayoutEvent =
  | { type: "BatchCreated"; id: bigint; sender: string; token: string; recipientCount: number }
  | { type: "PayoutExecuted"; id: bigint; recipient: string; amount: bigint }
  | { type: "BatchCompleted"; id: bigint; totalAmount: bigint };

export type DecodedEvent =
  | (EscrowEvent & { contract: "escrow" })
  | (StreamEvent & { contract: "stream" })
  | (VestingEvent & { contract: "vesting" })
  | (RecurringEvent & { contract: "recurring" })
  | (BatchPayoutEvent & { contract: "batch_payout" });

function decodeEscrowEvent(rawEvent: RawEvent): EscrowEvent {
  const topicVals = rawEvent.topics.map((t) => scValToNative(t));
  const dataVal = scValToNative(rawEvent.data);
  const eventType = topicVals[0] as string;

  switch (eventType) {
    case "Initialized":
      return {
        type: "Initialized",
        depositor: topicVals[1] as string,
        beneficiary: topicVals[2] as string,
        arbiter: (topicVals[3] as string | null) ?? null,
        token: dataVal.token as string,
        amount: BigInt(dataVal.amount),
        deadline: BigInt(dataVal.deadline),
      };
    case "Funded":
      return {
        type: "Funded",
        amount: BigInt(dataVal),
      };
    case "Released":
      return {
        type: "Released",
        beneficiary: topicVals[1] as string,
        amount: BigInt(dataVal),
      };
    case "Refunded":
      return {
        type: "Refunded",
        depositor: topicVals[1] as string,
        amount: BigInt(dataVal),
      };
    case "Disputed":
      return {
        type: "Disputed",
        caller: topicVals[1] as string,
      };
    case "Resolved":
      return {
        type: "Resolved",
        beneficiaryAmount: BigInt(dataVal.beneficiary),
        depositorAmount: BigInt(dataVal.depositor),
      };
    default:
      throw new Error(`Unknown escrow event type: ${eventType}`);
  }
}

function decodeStreamEvent(rawEvent: RawEvent): StreamEvent {
  const topicVals = rawEvent.topics.map((t) => scValToNative(t));
  const dataVal = scValToNative(rawEvent.data);
  const eventType = topicVals[0] as string;

  switch (eventType) {
    case "StreamCreated":
      return {
        type: "StreamCreated",
        id: BigInt(topicVals[1]),
        sender: dataVal.sender as string,
        recipient: dataVal.recipient as string,
        token: dataVal.token as string,
        ratePerSecond: BigInt(dataVal.ratePerSecond),
        startsAt: BigInt(dataVal.startsAt),
        endsAt: BigInt(dataVal.endsAt),
      };
    case "StreamWithdrawn":
      return {
        type: "StreamWithdrawn",
        id: BigInt(topicVals[1]),
        recipient: topicVals[2] as string,
        amount: BigInt(dataVal),
      };
    case "StreamCancelled":
      return {
        type: "StreamCancelled",
        id: BigInt(topicVals[1]),
        sender: topicVals[2] as string,
        remainingBalance: BigInt(dataVal),
      };
    case "StreamPaused":
      return {
        type: "StreamPaused",
        id: BigInt(topicVals[1]),
      };
    case "StreamResumed":
      return {
        type: "StreamResumed",
        id: BigInt(topicVals[1]),
      };
    default:
      throw new Error(`Unknown stream event type: ${eventType}`);
  }
}

function decodeVestingEvent(rawEvent: RawEvent): VestingEvent {
  const topicVals = rawEvent.topics.map((t) => scValToNative(t));
  const dataVal = scValToNative(rawEvent.data);
  const eventType = topicVals[0] as string;

  switch (eventType) {
    case "VestingCreated":
      return {
        type: "VestingCreated",
        id: BigInt(topicVals[1]),
        beneficiary: dataVal.beneficiary as string,
        token: dataVal.token as string,
        totalAmount: BigInt(dataVal.totalAmount),
        startTime: BigInt(dataVal.startTime),
        cliffTime: BigInt(dataVal.cliffTime),
        endTime: BigInt(dataVal.endTime),
      };
    case "VestingClaimed":
      return {
        type: "VestingClaimed",
        id: BigInt(topicVals[1]),
        beneficiary: topicVals[2] as string,
        amount: BigInt(dataVal),
      };
    case "VestingRevoked":
      return {
        type: "VestingRevoked",
        id: BigInt(topicVals[1]),
        unvestedAmount: BigInt(dataVal),
      };
    default:
      throw new Error(`Unknown vesting event type: ${eventType}`);
  }
}

function decodeRecurringEvent(rawEvent: RawEvent): RecurringEvent {
  const topicVals = rawEvent.topics.map((t) => scValToNative(t));
  const dataVal = scValToNative(rawEvent.data);
  const eventType = topicVals[0] as string;

  switch (eventType) {
    case "SubscriptionCreated":
      return {
        type: "SubscriptionCreated",
        id: BigInt(topicVals[1]),
        subscriber: dataVal.subscriber as string,
        recipient: dataVal.recipient as string,
        token: dataVal.token as string,
        amount: BigInt(dataVal.amount),
        interval: BigInt(dataVal.interval),
      };
    case "PaymentProcessed":
      return {
        type: "PaymentProcessed",
        id: BigInt(topicVals[1]),
        amount: BigInt(dataVal.amount),
        timestamp: BigInt(dataVal.timestamp),
      };
    case "SubscriptionCancelled":
      return {
        type: "SubscriptionCancelled",
        id: BigInt(topicVals[1]),
        timestamp: BigInt(dataVal),
      };
    default:
      throw new Error(`Unknown recurring event type: ${eventType}`);
  }
}

function decodeBatchPayoutEvent(rawEvent: RawEvent): BatchPayoutEvent {
  const topicVals = rawEvent.topics.map((t) => scValToNative(t));
  const dataVal = scValToNative(rawEvent.data);
  const eventType = topicVals[0] as string;

  switch (eventType) {
    case "BatchCreated":
      return {
        type: "BatchCreated",
        id: BigInt(topicVals[1]),
        sender: dataVal.sender as string,
        token: dataVal.token as string,
        recipientCount: Number(dataVal.recipientCount),
      };
    case "PayoutExecuted":
      return {
        type: "PayoutExecuted",
        id: BigInt(topicVals[1]),
        recipient: topicVals[2] as string,
        amount: BigInt(dataVal),
      };
    case "BatchCompleted":
      return {
        type: "BatchCompleted",
        id: BigInt(topicVals[1]),
        totalAmount: BigInt(dataVal),
      };
    default:
      throw new Error(`Unknown batch payout event type: ${eventType}`);
  }
}

/**
 * Decode a contract event into a typed discriminated union.
 *
 * @param contract - The contract that emitted the event
 * @param rawEvent - The raw event from the RPC including topics and data
 * @returns A typed event object with discriminated union based on event type
 *
 * @example
 * ```ts
 * const event = decodeEvent("escrow", rawEvent);
 * if (event.type === "Released") {
 *   console.log(`${event.beneficiary} received ${event.amount}`);
 * }
 * ```
 */
export function decodeEvent(
  contract: ContractName,
  rawEvent: RawEvent,
): DecodedEvent {
  switch (contract) {
    case "escrow":
      return { ...decodeEscrowEvent(rawEvent), contract: "escrow" };
    case "stream":
      return { ...decodeStreamEvent(rawEvent), contract: "stream" };
    case "vesting":
      return { ...decodeVestingEvent(rawEvent), contract: "vesting" };
    case "recurring":
      return { ...decodeRecurringEvent(rawEvent), contract: "recurring" };
    case "batch_payout":
      return { ...decodeBatchPayoutEvent(rawEvent), contract: "batch_payout" };
    case "common":
      throw new Error("Common library does not emit events");
  }
}
