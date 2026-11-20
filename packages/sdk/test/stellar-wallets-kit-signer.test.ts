import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { SigningError } from "../src/signers/index.js";
import {
  StellarWalletsKitSigner,
  type StellarWalletsKitApi,
} from "../src/signers/stellar-wallets-kit.js";

const ALICE = "GC4RWN3HH5H5GMD3NT4MOIYC3H3Q3NUF4BFWATGDI7NKRVLRURKHSIMC";

function stubKit(overrides: Partial<StellarWalletsKitApi> = {}): StellarWalletsKitApi {
  return {
    getAddress: vi.fn(async () => ({ address: ALICE })),
    signTransaction: vi.fn(async (xdr) => ({ signedTxXdr: `signed:${xdr}` })),
    ...overrides,
  };
}

describe("StellarWalletsKitSigner.connect", () => {
  it("resolves the address from the kit and sets publicKey", async () => {
    const signer = await StellarWalletsKitSigner.connect(stubKit());
    expect(signer.publicKey).toBe(ALICE);
  });

  it("throws SigningError when getAddress() throws", async () => {
    const kit = stubKit({
      getAddress: async () => { throw new Error("wallet locked"); },
    });

    const attempt = StellarWalletsKitSigner.connect(kit);
    await expect(attempt).rejects.toBeInstanceOf(SigningError);
    await expect(attempt).rejects.toThrow(/could not read an address/);
  });

  it("wraps the original cause inside the SigningError", async () => {
    const cause = new Error("wallet locked");
    const kit = stubKit({ getAddress: async () => { throw cause; } });

    const error = await StellarWalletsKitSigner.connect(kit).catch((e: unknown) => e);
    expect((error as SigningError).cause).toBe(cause);
  });

  it("throws SigningError when getAddress() returns an empty address", async () => {
    const kit = stubKit({ getAddress: async () => ({ address: "" }) });

    const attempt = StellarWalletsKitSigner.connect(kit);
    await expect(attempt).rejects.toBeInstanceOf(SigningError);
    await expect(attempt).rejects.toThrow(/empty address/);
  });
});

describe("StellarWalletsKitSigner.signTransaction", () => {
  it("forwards xdr and options to the kit and returns the signed envelope", async () => {
    const signTransaction = vi.fn(async (xdr: string) => ({ signedTxXdr: `signed:${xdr}` }));
    const signer = await StellarWalletsKitSigner.connect(stubKit({ signTransaction }));

    const result = await signer.signTransaction("TXDATA", {
      networkPassphrase: Networks.TESTNET,
    });

    expect(result).toBe("signed:TXDATA");
    expect(signTransaction).toHaveBeenCalledWith("TXDATA", {
      address: ALICE,
      networkPassphrase: Networks.TESTNET,
    });
  });

  it("throws SigningError when the kit throws (user declined)", async () => {
    const kit = stubKit({
      signTransaction: async () => { throw new Error("User declined"); },
    });
    const signer = await StellarWalletsKitSigner.connect(kit);

    const attempt = signer.signTransaction("TXDATA", {
      networkPassphrase: Networks.TESTNET,
    });
    await expect(attempt).rejects.toBeInstanceOf(SigningError);
    await expect(attempt).rejects.toThrow(/did not sign the transaction/);
  });

  it("wraps the decline cause inside the SigningError", async () => {
    const cause = new Error("User declined");
    const kit = stubKit({ signTransaction: async () => { throw cause; } });
    const signer = await StellarWalletsKitSigner.connect(kit);

    const error = await signer
      .signTransaction("TXDATA", { networkPassphrase: Networks.TESTNET })
      .catch((e: unknown) => e);
    expect((error as SigningError).cause).toBe(cause);
  });

  it("throws SigningError when signedTxXdr is empty", async () => {
    const kit = stubKit({ signTransaction: async () => ({ signedTxXdr: "" }) });
    const signer = await StellarWalletsKitSigner.connect(kit);

    const attempt = signer.signTransaction("TXDATA", {
      networkPassphrase: Networks.TESTNET,
    });
    await expect(attempt).rejects.toBeInstanceOf(SigningError);
    await expect(attempt).rejects.toThrow(/empty signed envelope/);
  });
});

describe("StellarWalletsKitSigner satisfies the Signer interface", () => {
  it("is a Signer: has publicKey and signTransaction", async () => {
    const signer = await StellarWalletsKitSigner.connect(stubKit());
    expect(typeof signer.publicKey).toBe("string");
    expect(typeof signer.signTransaction).toBe("function");
  });
});
