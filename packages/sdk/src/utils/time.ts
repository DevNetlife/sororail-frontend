import { ValidationError } from "../errors/index.js";

export function toUnixSeconds(date: Date): bigint {
  return BigInt(Math.floor(date.getTime() / 1000));
}

export function fromUnixSeconds(ts: bigint): Date {
  if (ts < 0n) {
    throw new ValidationError("Unix timestamp cannot be negative.");
  }
  if (ts > Number.MAX_SAFE_INTEGER) {
    throw new ValidationError(
      `Timestamp ${ts} is too large to convert to a Date (exceeds MAX_SAFE_INTEGER).`,
    );
  }
  return new Date(Number(ts) * 1000);
}

export const seconds = 1n;
export const minutes = 60n;
export const hours = 3600n;
export const days = 86400n;
export const weeks = 604800n;
