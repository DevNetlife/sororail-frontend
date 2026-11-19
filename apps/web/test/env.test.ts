import { describe, expect, it } from "vitest";

import {
  DEFAULT_BATCH_PAYOUT_ID,
  DEFAULT_RPC_URL,
  DEFAULT_TOKEN_ID,
  parseEnv,
} from "../src/lib/env";

const VALID_CONTRACT = "C" + "A".repeat(55);

describe("parseEnv: valid configuration", () => {
  it("uses the testnet defaults when nothing is set", () => {
    expect(parseEnv({})).toEqual({
      rpcUrl: DEFAULT_RPC_URL,
      tokenId: DEFAULT_TOKEN_ID,
      batchPayoutId: DEFAULT_BATCH_PAYOUT_ID,
      explorerUrl: null,
    });
  });

  it("accepts well-formed overrides and trims whitespace", () => {
    const env = parseEnv({
      NEXT_PUBLIC_RPC_URL: " https://rpc.example.org ",
      NEXT_PUBLIC_TOKEN_ID: VALID_CONTRACT,
      NEXT_PUBLIC_EXPLORER_URL: "https://explorer.example.org/",
    });

    expect(env.rpcUrl).toBe("https://rpc.example.org");
    expect(env.tokenId).toBe(VALID_CONTRACT);
    expect(env.explorerUrl).toBe("https://explorer.example.org/");
  });

  it("treats an empty value as unset", () => {
    expect(parseEnv({ NEXT_PUBLIC_RPC_URL: "   " }).rpcUrl).toBe(DEFAULT_RPC_URL);
  });
});

describe("parseEnv: malformed configuration", () => {
  it.each([
    ["NEXT_PUBLIC_RPC_URL", "soroban-testnet.stellar.org"],
    ["NEXT_PUBLIC_RPC_URL", "ftp://rpc.example.org"],
    ["NEXT_PUBLIC_EXPLORER_URL", "not a url"],
  ])("rejects a bad URL in %s: %s", (name, value) => {
    expect(() => parseEnv({ [name]: value })).toThrow(
      new RegExp(`${name}: must be an http`),
    );
  });

  it.each([
    ["NEXT_PUBLIC_TOKEN_ID", "GTOKEN"],
    ["NEXT_PUBLIC_BATCH_PAYOUT_ID", "G" + "A".repeat(55)],
    ["NEXT_PUBLIC_BATCH_PAYOUT_ID", "C" + "a".repeat(55)],
  ])("rejects a malformed contract address in %s", (name, value) => {
    expect(() => parseEnv({ [name]: value })).toThrow(
      new RegExp(`${name}: must be a Stellar contract address`),
    );
  });

  it("reports every bad variable in one error", () => {
    let message = "";
    try {
      parseEnv({
        NEXT_PUBLIC_RPC_URL: "nope",
        NEXT_PUBLIC_TOKEN_ID: "GBAD",
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("Invalid environment configuration");
    expect(message).toContain("NEXT_PUBLIC_RPC_URL");
    expect(message).toContain("NEXT_PUBLIC_TOKEN_ID");
  });
});
