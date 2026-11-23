import { beforeEach, describe, expect, it, vi } from "vitest";
import { StreamClient } from "../src/clients/stream.js";
import { Networks } from "@stellar/stellar-sdk";

describe("getEvents pagination", () => {
  let client: StreamClient;

  beforeEach(() => {
    client = new StreamClient({
      contractId: "CBEEAF3JKPF4RQXPJ3NTKSQFNMILMMYFQ3FH3YFQCFABOPBKSCGC7",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: Networks.TESTNET,
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    });
  });

  it("fetches events across two pages", async () => {
    const mockEvents = [
      { type: "contract", contractId: client.contractId, topic: [], value: {}, ledger: "100", pagingToken: "token1" },
      { type: "contract", contractId: client.contractId, topic: [], value: {}, ledger: "101", pagingToken: "token2" },
    ];

    let callCount = 0;
    vi.spyOn(client["server"], "getEvents").mockImplementation(async (opts) => {
      callCount++;
      if (callCount === 1) {
        return {
          events: [mockEvents[0]],
          latestLedger: 102,
        };
      }
      return {
        events: [mockEvents[1]],
        latestLedger: 102,
      };
    });

    const events = [];
    for await (const event of client.events({ fromLedger: 100, limit: 1 })) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].ledger).toBe(100);
    expect(events[1].ledger).toBe(101);
    expect(callCount).toBe(2);
  });

  it("handles retention window gracefully", async () => {
    vi.spyOn(client["server"], "getEvents").mockRejectedValue(
      new Error("ledger 50 not found"),
    );

    const events = [];
    for await (const event of client.events({ fromLedger: 50 })) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
  });
});
