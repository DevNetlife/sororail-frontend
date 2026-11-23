import { beforeEach, describe, expect, it, vi } from "vitest";
import { StreamClient } from "../src/clients/stream.js";
import { TimeoutError } from "../src/errors/index.js";
import { Networks } from "@stellar/stellar-sdk";

describe("Request timeout", () => {
  let client: StreamClient;

  beforeEach(() => {
    client = new StreamClient({
      contractId: "CBEEAF3JKPF4RQXPJ3NTKSQFNMILMMYFQ3FH3YFQCFABOPBKSCGC7",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: Networks.TESTNET,
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      timeoutMs: 100,
    });
  });

  it("rejects when RPC never responds", async () => {
    vi.spyOn(client["server"], "getAccount").mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 500);
        }),
    );

    await expect(
      client.create({
        sender: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        recipient: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        ratePerSecond: 1000n,
        start: 1000n,
        stop: 2000n,
        cancellable: true,
      }),
    ).rejects.toThrow(TimeoutError);
  });
});
