/**
 * Build-time validation for the web app's `NEXT_PUBLIC_*` configuration.
 *
 * Every variable is optional and falls back to a testnet default. A value that
 * is set but malformed throws one readable error that names each bad variable,
 * so a typo fails the build instead of showing up later as a runtime fetch
 * failure.
 *
 * Pass the variables explicitly (`parseEnv({ NEXT_PUBLIC_RPC_URL: process.env[...] })`),
 * not `process.env` as a whole: Next.js only inlines a `NEXT_PUBLIC_*` value when
 * it is referenced by its literal name.
 */

export const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
export const DEFAULT_TOKEN_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const DEFAULT_BATCH_PAYOUT_ID =
  "CDKJ56S7K7QC4LG6SFF2OGDTG6N4QBCJOVRWHY7MKCWD5JPQ6MDAHRAM";

export interface EnvSource {
  NEXT_PUBLIC_RPC_URL?: string;
  NEXT_PUBLIC_TOKEN_ID?: string;
  NEXT_PUBLIC_BATCH_PAYOUT_ID?: string;
  NEXT_PUBLIC_EXPLORER_URL?: string;
}

export interface AppEnv {
  rpcUrl: string;
  tokenId: string;
  batchPayoutId: string;
  /** `null` when unset, so the caller can derive it from the RPC URL. */
  explorerUrl: string | null;
}

/** A Stellar contract address (strkey): `C`, then 55 base32 characters. */
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

function readValue(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function httpUrlProblem(value: string): string | null {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:"
      ? null
      : "must be an http:// or https:// URL";
  } catch {
    return "must be an http:// or https:// URL";
  }
}

function contractIdProblem(value: string): string | null {
  return CONTRACT_ID.test(value)
    ? null
    : "must be a Stellar contract address (starts with C, 56 characters)";
}

/**
 * Validates the configuration.
 *
 * @throws {Error} listing every malformed variable, one per line.
 */
export function parseEnv(source: EnvSource): AppEnv {
  const problems: string[] = [];

  const check = (
    name: keyof EnvSource,
    validate: (value: string) => string | null,
  ): string | undefined => {
    const value = readValue(source[name]);
    if (value === undefined) return undefined;
    const problem = validate(value);
    if (problem) {
      problems.push(`  - ${name}: ${problem} (got "${value}")`);
      return undefined;
    }
    return value;
  };

  const rpcUrl = check("NEXT_PUBLIC_RPC_URL", httpUrlProblem);
  const tokenId = check("NEXT_PUBLIC_TOKEN_ID", contractIdProblem);
  const batchPayoutId = check("NEXT_PUBLIC_BATCH_PAYOUT_ID", contractIdProblem);
  const explorerUrl = check("NEXT_PUBLIC_EXPLORER_URL", httpUrlProblem);

  if (problems.length > 0) {
    throw new Error(
      ["Invalid environment configuration for apps/web:", ...problems].join("\n"),
    );
  }

  return {
    rpcUrl: rpcUrl ?? DEFAULT_RPC_URL,
    tokenId: tokenId ?? DEFAULT_TOKEN_ID,
    batchPayoutId: batchPayoutId ?? DEFAULT_BATCH_PAYOUT_ID,
    explorerUrl: explorerUrl ?? null,
  };
}
