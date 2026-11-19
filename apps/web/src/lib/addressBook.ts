export interface AddressBookEntry {
  address: string;
  label: string;
}

export const MAX_LABEL_LENGTH = 40;

const ACCOUNT_ADDRESS = /^G[A-Z2-7]{55}$/;

export type AddAddressResult =
  | { ok: true; entries: AddressBookEntry[] }
  | { ok: false; error: string };

/**
 * Adds or relabels an address. Session-only: callers hold the list in React
 * state, so it is never written to storage and is gone on reload.
 */
export function addAddressBookEntry(
  entries: readonly AddressBookEntry[],
  address: string,
  label: string,
): AddAddressResult {
  const cleanAddress = address.trim();
  const cleanLabel = label.trim();
  if (!ACCOUNT_ADDRESS.test(cleanAddress)) {
    return { ok: false, error: "Not a valid account address (G…)" };
  }
  if (cleanLabel.length === 0) {
    return { ok: false, error: "Enter a label for this address" };
  }
  if (cleanLabel.length > MAX_LABEL_LENGTH) {
    return { ok: false, error: `Label must be ${MAX_LABEL_LENGTH} characters or fewer` };
  }
  const others = entries.filter((entry) => entry.address !== cleanAddress);
  return { ok: true, entries: [...others, { address: cleanAddress, label: cleanLabel }] };
}

export function removeAddressBookEntry(
  entries: readonly AddressBookEntry[],
  address: string,
): AddressBookEntry[] {
  return entries.filter((entry) => entry.address !== address);
}

export function labelFor(
  entries: readonly AddressBookEntry[],
  address: string,
): string | undefined {
  return entries.find((entry) => entry.address === address)?.label;
}
