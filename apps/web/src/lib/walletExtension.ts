/** Where to install the wallet this app signs with (#445). */
export const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";

/**
 * True when a wallet extension API is present on the page. `FreighterSigner`
 * looks for the same `freighterApi` global, so this predicts whether Connect
 * can work at all, instead of letting it fail with a generic error.
 */
export function hasWalletExtension(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as { freighterApi?: unknown }).freighterApi !== "undefined";
}
