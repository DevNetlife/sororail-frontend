/**
 * Contract-address (`C…` strkey) validation without `@stellar/stellar-sdk`.
 *
 * `positions.ts` is reached from the overview route through the position
 * registry, and a static `StrKey` import there pulled the whole Stellar SDK
 * into that route's first-load JavaScript just to check an address (#432).
 * A strkey is small enough to check directly: base32 of one version byte, the
 * 32-byte payload and a CRC16-XModem checksum (little-endian), exactly as
 * `StrKey.isValidContract` does.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STRKEY_LENGTH = 56;
const DECODED_LENGTH = 35;
/** `C`: version byte 2 << 3, as in stellar-base's strkey table. */
const CONTRACT_VERSION_BYTE = 2 << 3;

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function decodeBase32(value: string): Uint8Array | null {
  const out = new Uint8Array(DECODED_LENGTH);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of value) {
    const digit = BASE32_ALPHABET.indexOf(char);
    if (digit < 0) return null;
    buffer = ((buffer << 5) | digit) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return index === DECODED_LENGTH && bits === 0 ? out : null;
}

/** True for a well-formed contract address; same answer as `StrKey.isValidContract`. */
export function isValidContractStrKey(value: string): boolean {
  if (value.length !== STRKEY_LENGTH) return false;
  const bytes = decodeBase32(value);
  if (!bytes || bytes[0] !== CONTRACT_VERSION_BYTE) return false;
  const checksum = crc16Xmodem(bytes.subarray(0, DECODED_LENGTH - 2));
  return (
    bytes[DECODED_LENGTH - 2] === (checksum & 0xff) &&
    bytes[DECODED_LENGTH - 1] === (checksum >> 8)
  );
}
