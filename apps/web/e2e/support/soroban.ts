import { expect, type Page } from "@playwright/test";
import { Address, xdr } from "@stellar/stellar-sdk";

/**
 * Shared wallet and RPC stubs for end-to-end flows that submit transactions.
 *
 * The RPC mock decodes every transaction the app simulates or sends, so a
 * spec answers by contract function rather than by call order, and can assert
 * exactly what would have been signed. Return values are built with the real
 * XDR types, so the SDK's parsers see the same shapes a node would return.
 */

export const STUB_ADDRESS = "GC4RWN3HH5H5GMD3NT4MOIYC3H3Q3NUF4BFWATGDI7NKRVLRURKHSIMC";
export const OTHER_ADDRESS = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";
export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const TESTNET_RPC = "https://soroban-testnet.stellar.org";

// Same fixtures as the escrow-creation test in app.spec.ts: an account entry
// for the source account, and minimal Soroban transaction data / envelope.
const ACCOUNT_ENTRY_XDR =
  "AAAAAAAAAAC5GzdnP0/TMHts+McjAtn3DbaF4EtgTMNH2qjVcaRUeQAAAAAF9eEAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAA";
const TRANSACTION_DATA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQ=";
const ENVELOPE_XDR =
  "AAAAAgAAAAC5GzdnP0/TMHts+McjAtn3DbaF4EtgTMNH2qjVcaRUeQAAAGQAAAAAAAAAAgAAAAEAAAAAAAAAAAAAAABq0jY5AAAAAAAAAAEAAAAAAAAACgAAAAdmaXh0dXJlAAAAAAEAAAACb2sAAAAAAAAAAAAA";
const RESULT_XDR = "AAAAAAAAAGQAAAAAAAAAAAAAAAA=";

export interface Invocation {
  contract: string;
  fn: string;
  args: xdr.ScVal[];
}

/** Reads the single contract call out of a base64 transaction envelope. */
export function decodeInvocation(envelope: string): Invocation {
  const tx = xdr.TransactionEnvelope.fromXDR(envelope, "base64").v1().tx();
  const call = tx.operations()[0]!.body().invokeHostFunctionOp().hostFunction().invokeContract();
  return {
    contract: Address.fromScAddress(call.contractAddress()).toString(),
    fn: call.functionName().toString(),
    args: call.args(),
  };
}

/**
 * `TransactionMeta` v3 carrying only a Soroban return value, which is what the
 * SDK reads after confirmation. Layout (XDR, big-endian 32-bit words):
 * v=3 · ext=0 · txChangesBefore=[] · operations=[] · txChangesAfter=[] ·
 * sorobanMeta present · sorobanMeta.ext=0 · events=[] · returnValue · diagnosticEvents=[].
 * With `sorobanMeta` absent this is exactly the meta used in app.spec.ts.
 */
function successMeta(returnValue: xdr.ScVal): string {
  const word = (n: number) => {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(n);
    return bytes;
  };
  return Buffer.concat([
    word(3), word(0), word(0), word(0), word(0),
    word(1), word(0), word(0),
    returnValue.toXDR(),
    word(0),
  ]).toString("base64");
}

export interface SorobanHandlers {
  /** Return value for a read or a pre-submit simulation of `call`. */
  simulate(call: Invocation): xdr.ScVal;
  /** Return value once a sent `call` confirms; defaults to void. */
  send?(call: Invocation): xdr.ScVal | undefined;
}

/** Routes testnet RPC to the handlers. Returns the calls actually sent. */
export async function mockSoroban(page: Page, handlers: SorobanHandlers) {
  const sent: Invocation[] = [];
  let lastReturn: xdr.ScVal = xdr.ScVal.scvVoid();

  await page.route(/soroban-testnet\.stellar\.org/, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const body = request.postDataJSON() as {
      id: number;
      method: string;
      params?: { keys?: string[]; transaction?: string };
    };
    let result: Record<string, unknown>;
    switch (body.method) {
      case "getNetwork":
        result = { passphrase: TESTNET_PASSPHRASE };
        break;
      case "getLedgerEntries":
        result = {
          latestLedger: 1,
          entries: [
            { key: body.params?.keys?.[0], xdr: ACCOUNT_ENTRY_XDR, lastModifiedLedgerSeq: 1 },
          ],
        };
        break;
      case "simulateTransaction": {
        const call = decodeInvocation(body.params!.transaction!);
        result = {
          transactionData: TRANSACTION_DATA,
          minResourceFee: "100",
          latestLedger: 1,
          events: [],
          results: [{ auth: [], xdr: handlers.simulate(call).toXDR("base64") }],
        };
        break;
      }
      case "sendTransaction": {
        const call = decodeInvocation(body.params!.transaction!);
        sent.push(call);
        lastReturn = handlers.send?.(call) ?? xdr.ScVal.scvVoid();
        result = {
          status: "PENDING",
          hash: sent.length.toString(16).padStart(64, "a"),
          latestLedger: 1,
          latestLedgerCloseTime: 1,
        };
        break;
      }
      case "getTransaction":
        result = {
          status: "SUCCESS",
          latestLedger: 1,
          latestLedgerCloseTime: 1,
          oldestLedger: 1,
          oldestLedgerCloseTime: 1,
          ledger: 1,
          createdAt: 1,
          applicationOrder: 1,
          feeBump: false,
          envelopeXdr: ENVELOPE_XDR,
          resultXdr: RESULT_XDR,
          resultMetaXdr: successMeta(lastReturn),
          events: { contractEventsXdr: [], transactionEventsXdr: [] },
        };
        break;
      default:
        result = {};
    }
    await route.fulfill({ json: { jsonrpc: "2.0", id: body.id, result } });
  });

  return { sent };
}

/**
 * A fake Freighter that is already authorised for `STUB_ADDRESS` and records
 * every transaction it is asked to sign in `window.__signed`.
 */
export async function stubWallet(page: Page) {
  await page.addInitScript((address) => {
    let current = address;
    const signed: string[] = [];
    const scope = globalThis as Record<string, unknown>;
    scope["__signed"] = signed;
    scope["freighterApi"] = {
      isConnected: async () => true,
      getAddress: async () => ({ address: current }),
      signTransaction: async (txXdr: string) => {
        signed.push(txXdr);
        return { signedTxXdr: txXdr };
      },
    };
    scope["switchFreighterAccount"] = (next: string) => {
      current = next;
    };
  }, STUB_ADDRESS);
}

/** Number of transactions the stubbed wallet has signed so far. */
export function signedCount(page: Page): Promise<number> {
  return page.evaluate(
    () => ((globalThis as Record<string, unknown>)["__signed"] as string[]).length,
  );
}

/** Switches the stubbed wallet's account the way a user would in the extension. */
export async function switchAccount(page: Page, next: string) {
  await page.evaluate((address) => {
    (
      globalThis as unknown as { switchFreighterAccount: (a: string) => void }
    ).switchFreighterAccount(address);
    window.dispatchEvent(new Event("focus"));
  }, next);
  await expect(page.locator("nav").locator(`[title="${next}"]`)).toBeVisible();
}

/** The stub reports the site as authorised, so the session restores on load. */
export async function waitForConnected(page: Page) {
  await expect(page.getByText("Disconnect")).toBeVisible({ timeout: 10_000 });
}
