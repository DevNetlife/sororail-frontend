import { ValidationError } from "../errors/index.js";

export interface RateResult {
  rate: bigint;
  remainder: bigint;
}

export function ratePerSecond(
  amountPerPeriod: bigint,
  periodSeconds: bigint,
): RateResult {
  if (periodSeconds <= 0n) {
    throw new ValidationError("Period duration must be greater than zero.");
  }
  if (amountPerPeriod < 0n) {
    throw new ValidationError("Amount cannot be negative.");
  }

  const rate = amountPerPeriod / periodSeconds;
  const remainder = amountPerPeriod % periodSeconds;

  if (rate === 0n && amountPerPeriod > 0n) {
    throw new ValidationError(
      `The amount ${amountPerPeriod} divided by ${periodSeconds} seconds yields a rate of zero. Increase the amount or shorten the period.`,
    );
  }

  return { rate, remainder };
}
