import { readFileSync } from "node:fs";
import path from "node:path";

import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { isValidContractStrKey } from "../src/lib/strkey";

function randomContractId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return StrKey.encodeContract(Buffer.from(bytes));
}

describe("isValidContractStrKey (#432)", () => {
  it("accepts every contract address StrKey accepts", () => {
    for (let i = 0; i < 200; i++) {
      const id = randomContractId();
      expect(isValidContractStrKey(id), id).toBe(true);
    }
  });

  it("agrees with StrKey on corrupted, wrong-type and malformed input", () => {
    const id = randomContractId();
    const candidates = [
      // One character changed: the checksum must catch it.
      `${id.slice(0, 20)}${id[20] === "A" ? "B" : "A"}${id.slice(21)}`,
      // Account, not contract.
      Keypair.random().publicKey(),
      id.slice(0, 55),
      `${id}A`,
      id.toLowerCase(),
      `${id.slice(0, 55)}1`,
      "",
    ];
    for (const value of candidates) {
      expect(isValidContractStrKey(value), value).toBe(StrKey.isValidContract(value));
    }
  });

  it("keeps the Stellar SDK out of positions.ts, which the overview route loads", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/lib/positions.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["']@stellar\/stellar-sdk["']/);
    expect(source).not.toMatch(/from\s+["']@sororail\/sdk["']/);
  });
});
