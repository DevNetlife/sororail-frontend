import { beforeEach, describe, expect, it, vi } from "vitest";

// #446: reads must work without a wallet. They simulate from the null account
// instead of loading a real one, while writes still require a publicKey.
const seen = vi.hoisted(() => ({ sources: [] as { accountId(): string; sequenceNumber(): string }[], getAccount: [] as string[] }));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  class FakeServer {
    async getAccount(publicKey: string) {
      seen.getAccount.push(publicKey);
      return new actual.Account(publicKey, "123");
    }
    async simulateTransaction() {
      return { error: "Error(Contract, #1)" };
    }
  }
  class FakeContract {
    constructor(_contractId: string) {}
    call(method: string, ...args: unknown[]) {
      return { method, args };
    }
  }
  class FakeTransactionBuilder {
    constructor(source: { accountId(): string; sequenceNumber(): string }, _opts: unknown) {
      seen.sources.push(source);
    }
    addOperation(_op: unknown) {
      return this;
    }
    setTimeout(_seconds: number) {
      return this;
    }
    build() {
      return { toXDR: () => "AAAA" };
    }
  }
  return {
    ...actual,
    rpc: { ...actual.rpc, Server: FakeServer },
    Contract: FakeContract,
    TransactionBuilder: FakeTransactionBuilder,
  };
});

import { ValidationError } from "../src/errors/index.js";
import { VestingClient } from "../src/clients/vesting.js";

const CONTRACT = "CCONTRACTADDRESSFORTESTINGONLYXXXXXXXXXXXXXXXXXXXXXX";
const ACCOUNT = "GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H";
const NULL_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function client(publicKey?: string): VestingClient {
  return new VestingClient({
    contractId: CONTRACT,
    rpcUrl: "http://localhost:8000",
    networkPassphrase: "Test SoroRail Network ; July 2026",
    ...(publicKey ? { publicKey } : {}),
    allowHttp: true,
  });
}

beforeEach(() => {
  seen.sources.length = 0;
  seen.getAccount.length = 0;
});

describe("read-only calls without a wallet (#446)", () => {
  it("simulates a read from the null account without loading any account", async () => {
    // The fake simulation reverts; what matters here is how the call was built.
    await client().get().catch(() => undefined);
    expect(seen.getAccount).toEqual([]);
    expect(seen.sources).toHaveLength(1);
    expect(seen.sources[0]!.accountId()).toBe(NULL_ACCOUNT);
    expect(seen.sources[0]!.sequenceNumber()).toBe("0");
  });

  it("still uses the configured account for reads when one is set", async () => {
    await client(ACCOUNT).get().catch(() => undefined);
    expect(seen.getAccount).toEqual([ACCOUNT]);
    expect(seen.sources[0]!.accountId()).toBe(ACCOUNT);
  });

  it("still refuses to build a write without a publicKey", async () => {
    await expect(client().revoke()).rejects.toBeInstanceOf(ValidationError);
    expect(seen.sources).toEqual([]);
  });
});
