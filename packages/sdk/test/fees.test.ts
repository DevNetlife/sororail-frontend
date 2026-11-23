import { beforeEach, describe, expect, it, vi } from "vitest";
import { StreamClient } from "../src/clients/stream.js";
import { ValidationError } from "../src/errors/index.js";
import { Networks, TransactionBuilder, Account } from "@stellar/stellar-sdk";

describe("Fee multiplier and max fee", () => {
  let client: StreamClient;

  beforeEach(() => {
    client = new StreamClient({
      contractId: "CBEEAF3JKPF4RQXPJ3NTKSQFNMILMMYFQ3FH3YFQCFABOPBKSCGC7",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: Networks.TESTNET,
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      feeMultiplier: 1.5,
      maxFee: "1000000",
    });
  });

  it("applies multiplier to simulated fee", async () => {
    const mockAccount = new Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "123456",
    );

    vi.spyOn(client["server"], "getAccount").mockResolvedValue(mockAccount);

    const baseTx = new TransactionBuilder(mockAccount, {
      fee: "100000",
      networkPassphrase: Networks.TESTNET,
    })
      .setTimeout(30)
      .build();

    vi.spyOn(client["server"], "prepareTransaction").mockResolvedValue(baseTx);

    const mockSigner = {
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      signTransaction: vi.fn().mockResolvedValue(baseTx.toXDR()),
    };

    vi.spyOn(client["server"], "sendTransaction").mockResolvedValue({
      status: "PENDING",
      hash: "abc123",
      errorResult: undefined,
    });

    vi.spyOn(client["server"], "pollTransaction").mockResolvedValue({
      status: "SUCCESS",
      returnValue: undefined,
    });

    const call = await client.withdraw(null);
    await call.signAndSend(mockSigner);

    expect(mockSigner.signTransaction).toHaveBeenCalled();
    const signedXdr = mockSigner.signTransaction.mock.calls[0][0];
    const signedTx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    expect(Number(signedTx.fee)).toBe(150000);
  });

  it("rejects when fee exceeds maxFee", async () => {
    const highFeeClient = new StreamClient({
      contractId: "CBEEAF3JKPF4RQXPJ3NTKSQFNMILMMYFQ3FH3YFQCFABOPBKSCGC7",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: Networks.TESTNET,
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      feeMultiplier: 10.0,
      maxFee: "100000",
    });

    const mockAccount = new Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "123456",
    );

    vi.spyOn(highFeeClient["server"], "getAccount").mockResolvedValue(mockAccount);

    const baseTx = new TransactionBuilder(mockAccount, {
      fee: "50000",
      networkPassphrase: Networks.TESTNET,
    })
      .setTimeout(30)
      .build();

    vi.spyOn(highFeeClient["server"], "prepareTransaction").mockResolvedValue(baseTx);

    const mockSigner = {
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      signTransaction: vi.fn(),
    };

    const call = await highFeeClient.withdraw(null);
    await expect(call.signAndSend(mockSigner)).rejects.toThrow(ValidationError);
    expect(mockSigner.signTransaction).not.toHaveBeenCalled();
  });

  it("uses default multiplier of 1.0 when not configured", async () => {
    const defaultClient = new StreamClient({
      contractId: "CBEEAF3JKPF4RQXPJ3NTKSQFNMILMMYFQ3FH3YFQCFABOPBKSCGC7",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: Networks.TESTNET,
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    });

    const mockAccount = new Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "123456",
    );

    vi.spyOn(defaultClient["server"], "getAccount").mockResolvedValue(mockAccount);

    const baseTx = new TransactionBuilder(mockAccount, {
      fee: "100000",
      networkPassphrase: Networks.TESTNET,
    })
      .setTimeout(30)
      .build();

    vi.spyOn(defaultClient["server"], "prepareTransaction").mockResolvedValue(baseTx);

    const mockSigner = {
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      signTransaction: vi.fn().mockResolvedValue(baseTx.toXDR()),
    };

    vi.spyOn(defaultClient["server"], "sendTransaction").mockResolvedValue({
      status: "PENDING",
      hash: "abc123",
      errorResult: undefined,
    });

    vi.spyOn(defaultClient["server"], "pollTransaction").mockResolvedValue({
      status: "SUCCESS",
      returnValue: undefined,
    });

    const call = await defaultClient.withdraw(null);
    await call.signAndSend(mockSigner);

    const signedXdr = mockSigner.signTransaction.mock.calls[0][0];
    const signedTx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    expect(Number(signedTx.fee)).toBe(100000);
  });
});
