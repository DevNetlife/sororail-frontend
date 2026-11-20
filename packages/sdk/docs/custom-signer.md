# Implementing a custom `Signer`

The SDK never holds a secret key. Instead, every operation that needs a
signature accepts a `Signer` — an object you supply that can produce a
signed transaction envelope. The SDK calls it once per transaction and
returns the result to the network.

This design lets you plug in any key-management system without forking
the SDK: a browser wallet, an HSM, a cloud KMS, a hardware device, or a
plain test keypair.

---

## The interface

```ts
export interface Signer {
  /** The Stellar G… address the signature will be attributed to. */
  readonly publicKey: string;

  /**
   * Signs a transaction envelope.
   *
   * @param xdr              Base64-encoded transaction envelope XDR.
   * @param options.networkPassphrase
   *                         The network passphrase the transaction was built
   *                         for (e.g. `Networks.TESTNET`).
   * @returns                The signed envelope, also base64 XDR.
   */
  signTransaction(
    xdr: string,
    options: { networkPassphrase: string },
  ): Promise<string>;
}
```

Both properties must be present on every implementation:

| Member | Type | Contract |
|---|---|---|
| `publicKey` | `string` | Stable `G…` address. Must not change between calls. |
| `signTransaction` | `async (xdr, { networkPassphrase }) => string` | Returns the signed XDR on success; throws `SigningError` on failure. |

---

## Error contract

If signing fails for any reason, `signTransaction` **must** throw a
`SigningError` (exported from `@sororail/sdk/signers`). Throwing a plain
`Error` or rejecting with a string will still propagate, but callers
that catch `SigningError` specifically (to show user-facing messages)
will miss it.

```ts
import { SigningError } from "@sororail/sdk/signers";

async signTransaction(xdr: string, options: { networkPassphrase: string }) {
  try {
    return await myKms.sign(xdr);
  } catch (cause) {
    throw new SigningError("KMS refused to sign the transaction.", { cause });
  }
}
```

Common failure cases to handle:

| Situation | Recommended message |
|---|---|
| User declined the prompt | `"Transaction was declined."` |
| Device not connected | `"Hardware wallet is not connected. Plug it in and try again."` |
| Wrong network on wallet | `"Wallet is set to <actual> but <expected> is required."` |
| KMS / API error | Include the original error as `cause`. |

---

## Worked example: AWS KMS signer

```ts
import { SigningError, type Signer } from "@sororail/sdk/signers";
import { TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { KMSClient, SignCommand } from "@aws-sdk/client-kms";

export class KmsSigner implements Signer {
  readonly publicKey: string;
  readonly #kms: KMSClient;
  readonly #keyId: string;

  constructor(kms: KMSClient, keyId: string, stellarPublicKey: string) {
    this.#kms      = kms;
    this.#keyId    = keyId;
    this.publicKey = stellarPublicKey;
  }

  async signTransaction(
    envelopeXdr: string,
    options: { networkPassphrase: string },
  ): Promise<string> {
    // 1. Decode to get the raw transaction hash to sign.
    const tx = TransactionBuilder.fromXDR(envelopeXdr, options.networkPassphrase);
    const hash = tx.hash();

    // 2. Ask KMS to sign the hash (ECDSA_SHA_256 for secp256k1 keys).
    let derSig: Uint8Array;
    try {
      const { Signature } = await this.#kms.send(
        new SignCommand({
          KeyId:            this.#keyId,
          Message:          hash,
          MessageType:      "DIGEST",
          SigningAlgorithm: "ECDSA_SHA_256",
        }),
      );
      if (!Signature) throw new Error("KMS returned no signature.");
      derSig = Signature;
    } catch (cause) {
      throw new SigningError("KMS refused to sign the transaction.", { cause });
    }

    // 3. Convert DER → raw 64-byte (r‖s), attach to the envelope.
    const rawSig = derToRaw(derSig); // implement or use a DER-decode lib
    tx.addSignature(this.publicKey, rawSig.toString("base64"));
    return tx.toXDR("base64");
  }
}
```

> **Tip:** `derToRaw` is not in the Stellar SDK; use a small helper or a
> library such as `@noble/curves` to decode the DER-encoded r and s values.

---

## Worked example: Ledger hardware wallet

```ts
import Str from "@ledgerhq/hw-app-str";
import Transport from "@ledgerhq/hw-transport-webusb";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { SigningError, type Signer } from "@sororail/sdk/signers";

export class LedgerSigner implements Signer {
  readonly publicKey: string;
  readonly #bip32Path: string;

  private constructor(publicKey: string, bip32Path: string) {
    this.publicKey  = publicKey;
    this.#bip32Path = bip32Path;
  }

  static async connect(bip32Path = "44'/148'/0'"): Promise<LedgerSigner> {
    const transport = await Transport.create();
    const str       = new Str(transport);
    const { publicKey } = await str.getPublicKey(bip32Path);
    return new LedgerSigner(publicKey, bip32Path);
  }

  async signTransaction(
    envelopeXdr: string,
    options: { networkPassphrase: string },
  ): Promise<string> {
    const transport = await Transport.create();
    const str       = new Str(transport);
    const tx        = TransactionBuilder.fromXDR(envelopeXdr, options.networkPassphrase);

    let result: { signature: Buffer };
    try {
      result = await str.signTransaction(this.#bip32Path, tx.signatureBase());
    } catch (cause) {
      throw new SigningError(
        "Ledger did not sign. Check the device and confirm the prompt.",
        { cause },
      );
    }

    tx.addSignature(this.publicKey, result.signature.toString("base64"));
    return tx.toXDR("base64");
  }
}
```

---

## Type-checking your implementation

The file `packages/sdk/examples/custom-signer.ts` contains runnable stub
implementations of both signers above. The examples tsconfig ensures they
compile against the current interface:

```sh
pnpm --filter @sororail/sdk typecheck:examples
```

If the `Signer` interface changes in a way that breaks your implementation,
this command reports the exact property or method that no longer matches.

---

## Built-in signers

For reference, the SDK ships two ready-made signers:

| Class | Use case |
|---|---|
| `KeypairSigner` | Tests, server-side scripts, keys you already control. |
| `FreighterSigner` | Browser extension wallet (Freighter). |

Both are exported from `@sororail/sdk/signers`.
