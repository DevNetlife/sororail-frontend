import { expect, test } from "@playwright/test";
import { nativeToScVal, scValToNative, type xdr } from "@stellar/stellar-sdk";

import {
  OTHER_ADDRESS,
  STUB_ADDRESS,
  mockSoroban,
  signedCount,
  stubWallet,
  waitForConnected,
} from "./support/soroban";

/**
 * Payroll happy path (#434): paste a CSV, check it against the chain, confirm,
 * and see the payout recorded — with the wallet and RPC stubbed, so the whole
 * app, the SDK client and the wallet adapter run for real.
 */

const DECIMALS = 7;
const MAX_RECIPIENTS = 50;

function receipt(payments: xdr.ScVal): xdr.ScVal {
  const list = scValToNative(payments) as { to: string; amount: bigint }[];
  return nativeToScVal(
    { count: list.length, total: list.reduce((sum, p) => sum + BigInt(p.amount), 0n) },
    { type: { count: ["symbol", "u32"], total: ["symbol", "i128"] } },
  );
}

test("pays a pasted payroll end to end with a mocked wallet", async ({ page }) => {
  test.setTimeout(60_000);
  await stubWallet(page);
  const { sent } = await mockSoroban(page, {
    simulate(call) {
      switch (call.fn) {
        case "decimals":
          return nativeToScVal(DECIMALS, { type: "u32" });
        case "max_recipients":
          return nativeToScVal(MAX_RECIPIENTS, { type: "u32" });
        case "preview":
          return receipt(call.args[0]!);
        case "execute":
          return receipt(call.args[2]!);
        default:
          throw new Error(`unexpected simulation of ${call.fn}`);
      }
    },
    send(call) {
      return call.fn === "execute" ? receipt(call.args[2]!) : undefined;
    },
  });

  await page.goto("/payroll");
  await waitForConnected(page);

  await page.locator("textarea").fill(`${OTHER_ADDRESS},10\n${STUB_ADDRESS},5.5`);
  await expect(page.getByText("2 recipients")).toBeVisible();

  // Preview: the contract's own validation, before any signature.
  await page.getByRole("button", { name: "Check against chain" }).click();
  await expect(page.getByText(/The contract accepts 2 recipients across 1 batch/)).toBeVisible();
  await expect(page.getByText(/Nothing has been sent/)).toBeVisible();
  expect(await signedCount(page)).toBe(0);

  await page.getByRole("button", { name: /^Pay 2/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Pay 2" }).click();

  await expect(page.getByText("Paid 2 recipients.")).toBeVisible();
  expect(await signedCount(page)).toBe(1);

  // Exactly one execute, paying each line its amount in the token's units.
  const executes = sent.filter((call) => call.fn === "execute");
  expect(executes).toHaveLength(1);
  const [funder, , recipients] = executes[0]!.args;
  expect(scValToNative(funder!)).toBe(STUB_ADDRESS);
  expect(
    (scValToNative(recipients!) as { to: string; amount: bigint }[]).map((p) => [
      p.to,
      p.amount.toString(),
    ]),
  ).toEqual([
    [OTHER_ADDRESS, "100000000"],
    [STUB_ADDRESS, "55000000"],
  ]);
});
