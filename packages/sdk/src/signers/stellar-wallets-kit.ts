import type { Signer } from "./index.js";
import { SigningError } from "./index.js";

/**
 * The minimal slice of `@creit.tech/stellar-wallets-kit` this adapter uses.
 *
 * Typed as an interface so callers can inject a mock in tests without
 * installing the real package.
 */
export interface StellarWalletsKitApi {
  getAddress(params?: { id?: string }): Promise<{ address: string }>;
  signTransaction(
    xdr: string,
    params: { address: string; networkPassphrase: string },
  ): Promise<{ signedTxXdr: string }>;
}

/**
 * Signs through any wallet supported by `@creit.tech/stellar-wallets-kit`
 * (xBull, Albedo, Lobstr, …).
 *
 * This lives in an optional entry point so apps that only use Freighter never
 * pull in the kit's bundle weight.  Import it from
 * `@sororail/sdk/stellar-wallets-kit`.
 *
 * Usage:
 * ```ts
 * import { StellarWalletsKit, WalletNetwork, LOBSTR_ID } from
 *   "@creit.tech/stellar-wallets-kit";
 * import { StellarWalletsKitSigner } from "@sororail/sdk/stellar-wallets-kit";
 *
 * const kit = new StellarWalletsKit({ network: WalletNetwork.TESTNET,
 *   selectedWalletId: LOBSTR_ID });
 * await kit.openModal({ onWalletSelected: (option) =>
 *   kit.setWallet(option.id) });
 * const signer = await StellarWalletsKitSigner.connect(kit);
 * ```
 */
export class StellarWalletsKitSigner implements Signer {
  readonly publicKey: string;
  readonly #kit: StellarWalletsKitApi;

  private constructor(kit: StellarWalletsKitApi, publicKey: string) {
    this.#kit = kit;
    this.publicKey = publicKey;
  }

  /**
   * Resolves the active address from the kit and returns a ready signer.
   *
   * @param kit A configured `StellarWalletsKit` instance (or a stub for tests).
   */
  static async connect(kit: StellarWalletsKitApi): Promise<StellarWalletsKitSigner> {
    let address: string;
    try {
      const result = await kit.getAddress();
      address = result.address;
    } catch (cause) {
      throw new SigningError(
        "StellarWalletsKit could not read an address. Make sure a wallet is selected and connected.",
        { cause },
      );
    }

    if (!address) {
      throw new SigningError(
        "StellarWalletsKit returned an empty address. Make sure a wallet is selected and unlocked.",
      );
    }

    return new StellarWalletsKitSigner(kit, address);
  }

  async signTransaction(
    xdr: string,
    options: { networkPassphrase: string },
  ): Promise<string> {
    let result: { signedTxXdr: string };
    try {
      result = await this.#kit.signTransaction(xdr, {
        address: this.publicKey,
        networkPassphrase: options.networkPassphrase,
      });
    } catch (cause) {
      throw new SigningError(
        "StellarWalletsKit did not sign the transaction. The user may have declined.",
        { cause },
      );
    }

    if (!result.signedTxXdr) {
      throw new SigningError(
        "StellarWalletsKit returned an empty signed envelope. The wallet may have cancelled.",
      );
    }

    return result.signedTxXdr;
  }
}
