import { StrKey } from "@stellar/stellar-sdk";

export function isValidAccountId(value: string): boolean {
  try {
    const normalized = value.trim().toUpperCase();
    return StrKey.isValidEd25519PublicKey(normalized);
  } catch {
    return false;
  }
}

export function isValidContractId(value: string): boolean {
  try {
    const normalized = value.trim().toUpperCase();
    return StrKey.isValidContract(normalized);
  } catch {
    return false;
  }
}
