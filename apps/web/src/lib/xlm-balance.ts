/** Native XLM balance lookup for the connected wallet (#400). */

export const HORIZON_URL =
  process.env["NEXT_PUBLIC_HORIZON_URL"] ?? "https://horizon-testnet.stellar.org";

/** Below this many XLM, fees are likely to fail. */
export const LOW_XLM_THRESHOLD = Number(process.env["NEXT_PUBLIC_LOW_XLM_THRESHOLD"] ?? "2");

/** Returns the native balance in XLM, or `0` for an unfunded account. */
export async function fetchXlmBalance(
  address: string,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const res = await fetcher(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`);
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`Horizon returned ${res.status}`);
  const body = (await res.json()) as { balances?: { asset_type: string; balance: string }[] };
  const native = body.balances?.find((b) => b.asset_type === "native");
  return native ? Number(native.balance) : 0;
}

export function isLowBalance(balance: number, threshold = LOW_XLM_THRESHOLD): boolean {
  return balance < threshold;
}
