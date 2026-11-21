/**
 * Custom Signer example — implementing the `Signer` interface for a third-party
 * key-management system.
 *
 * This file is type-checked by `pnpm --filter @sororail/sdk typecheck:examples`
 * (via tsconfig.examples.json) so a breaking change to the interface fails here.
 *
 * Issue #389
 */

import { Networks } from "@stellar/stellar-sdk";
import { type Signer, SigningError } from "../src/signers/index.js";

// ─── Example 1: AWS KMS signer stub ──────────────────────────────────────────
// In production you would call the real KMS SDK; the stub below shows the shape.

interface KmsClient {
  sign(keyId: string, payload: Buffer): Promise<Buffer>;
  getPublicKey(keyId: string): Promise<{ publicKey: Buffer }>;
}

/**
 * A `Signer` backed by AWS KMS.
 *
 * The secret key never leaves KMS; only the signed bytes come back.
 */
class KmsSigner implements Signer {
  readonly publicKey: string;
  readonly #client: KmsClient;
  readonly #keyId: string;

  /**
   * @param client  AWS KMS client (real or stubbed).
   * @param keyId   KMS key ID or ARN.
   * @param publicKey  The Stellar `G...` address derived from the KMS key.
   *                   Derive this once at startup by calling
   *                   `stellar keys show --key-manager kms --key-id <id>` or
   *                   use the KMS public-key response + a Stellar encoding lib.
   */
  constructor(client: KmsClient, keyId: string, publicKey: string) {
    this.#client = client;
    this.#keyId  = keyId;
    this.publicKey = publicKey;
  }

  async signTransaction(
    xdr: string,
    _options: { networkPassphrase: string },
  ): Promise<string> {
    // 1. Decode the XDR envelope to raw bytes for KMS.
    const payload = Buffer.from(xdr, "base64");

    let sig: Buffer;
    try {
      sig = await this.#client.sign(this.#keyId, payload);
    } catch (cause) {
      throw new SigningError("KMS refused to sign the transaction.", { cause });
    }

    // 2. Re-encode.  In a real implementation you would decode the XDR with
    //    @stellar/stellar-base, attach the DER→raw-decoded signature to the
    //    TransactionEnvelope, then return tx.toXDR("base64").
    //    For this example we return the KMS response directly to show the shape.
    return sig.toString("base64");
  }
}

// ─── Example 2: Hardware-wallet signer stub ───────────────────────────────────

interface LedgerTransport {
  send(cla: number, ins: number, p1: number, p2: number, data: Buffer): Promise<Buffer>;
}

/**
 * A `Signer` backed by a Ledger hardware wallet via `@ledgerhq/hw-transport`.
 *
 * Error handling follows the contract: any failure that prevents a valid signed
 * envelope from being returned must throw a `SigningError`.
 */
class LedgerSigner implements Signer {
  readonly publicKey: string;
  readonly #transport: LedgerTransport;
  readonly #bip32Path: string;

  constructor(transport: LedgerTransport, publicKey: string, bip32Path = "44'/148'/0'") {
    this.#transport = transport;
    this.publicKey  = publicKey;
    this.#bip32Path = bip32Path;
  }

  async signTransaction(
    xdr: string,
    _options: { networkPassphrase: string },
  ): Promise<string> {
    const txBytes = Buffer.from(xdr, "base64");
    let response: Buffer;
    try {
      // 0xe0 / 0x02 are the Stellar Ledger app APDU codes.
      response = await this.#transport.send(0xe0, 0x02, 0x00, 0x00, txBytes);
    } catch (cause) {
      throw new SigningError(
        "Ledger did not sign the transaction. Check the device and confirm the prompt.",
        { cause },
      );
    }
    return response.toString("base64");
  }
}

// ─── Type assertion: both classes satisfy the interface ───────────────────────
// If the Signer interface ever changes incompatibly, the following lines fail
// at compile time, which is exactly the feedback the CI type-check provides.

const _kmsAssert: Signer = new KmsSigner(
  // minimal stub — only the shape matters for the type check
  {
    async sign(_keyId: string, _payload: Buffer) { return Buffer.alloc(0); },
    async getPublicKey(_keyId: string) { return { publicKey: Buffer.alloc(0) }; },
  },
  "arn:aws:kms:us-east-1:123456789012:key/example",
  "GABC1234EXAMPLESTELLARADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
);
void _kmsAssert;

const _ledgerAssert: Signer = new LedgerSigner(
  {
    async send() { return Buffer.alloc(0); },
  },
  "GABC1234EXAMPLESTELLARADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
);
void _ledgerAssert;

// ─── Entry point (skipped by typecheck:examples, used by integration runner) ──

export async function run(): Promise<void> {
  console.log(
    "custom-signer.ts: type-check only — no live keys wired in this example.",
  );
  console.log("KMS signer public key    :", _kmsAssert.publicKey);
  console.log("Ledger signer public key :", _ledgerAssert.publicKey);
  console.log(
    "\nSee packages/sdk/docs/custom-signer.md for the full integration guide.",
  );
}
