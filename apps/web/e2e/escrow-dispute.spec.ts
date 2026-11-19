import { expect, test } from "@playwright/test";
import { Keypair, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

import {
  OTHER_ADDRESS,
  STUB_ADDRESS,
  TESTNET_RPC,
  mockSoroban,
  signedCount,
  stubWallet,
  switchAccount,
  waitForConnected,
} from "./support/soroban";

/**
 * Escrow dispute and arbiter resolution (#435): the depositor raises a
 * dispute, then the arbiter resolves it with a beneficiary split. The escrow's
 * on-chain state is simulated and advances only when the matching transaction
 * is actually sent through the mocked signer.
 */

const ESCROW_CONTRACT = "CDKJ56S7K7QC4LG6SFF2OGDTG6N4QBCJOVRWHY7MKCWD5JPQ6MDAHRAM";
const TOKEN = "CBEE4SRXRGCJDWXP6DDOSX6FR4S2PJ5KHUQCHI3ABY3SQTCHYSA7CGC7";
const BENEFICIARY = Keypair.random().publicKey();
const STATE = { Funded: 1, Disputed: 4, Resolved: 5 } as const;

function escrowScVal(state: number): xdr.ScVal {
  return nativeToScVal(
    {
      amount: 10_000_000n,
      arbiter: OTHER_ADDRESS,
      beneficiary: BENEFICIARY,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86_400),
      depositor: STUB_ADDRESS,
      state,
      token: TOKEN,
    },
    {
      type: {
        amount: ["symbol", "i128"],
        arbiter: ["symbol", "address"],
        beneficiary: ["symbol", "address"],
        deadline: ["symbol", "u64"],
        depositor: ["symbol", "address"],
        state: ["symbol", "u32"],
        token: ["symbol", "address"],
      },
    },
  );
}

test("depositor disputes, arbiter resolves with a split", async ({ page }) => {
  test.setTimeout(60_000);
  let state: number = STATE.Funded;

  await stubWallet(page);
  await page.addInitScript(
    ({ contractId, network }) => {
      window.localStorage.setItem(
        "sororail.positions.v2",
        JSON.stringify([
          { kind: "escrow", contractId, label: "Disputed escrow", addedAt: 1720000000000, network },
        ]),
      );
    },
    { contractId: ESCROW_CONTRACT, network: TESTNET_RPC },
  );
  const { sent } = await mockSoroban(page, {
    simulate(call) {
      switch (call.fn) {
        case "get":
          return escrowScVal(state);
        case "state":
          return nativeToScVal(state, { type: "u32" });
        case "dispute":
        case "resolve":
          return xdr.ScVal.scvVoid();
        default:
          throw new Error(`unexpected simulation of ${call.fn}`);
      }
    },
    send(call) {
      if (call.fn === "dispute") state = STATE.Disputed;
      if (call.fn === "resolve") state = STATE.Resolved;
      return undefined;
    },
  });

  await page.goto("/escrow");
  await waitForConnected(page);
  await expect(page.getByRole("heading", { name: "Disputed escrow" })).toBeVisible();

  // Depositor raises the dispute.
  await page.getByRole("button", { name: "Dispute", exact: true }).click();
  const disputeDialog = page.getByRole("dialog");
  await disputeDialog.getByRole("button", { name: "Raise a dispute" }).click();
  await expect(page.getByText("Dispute raised. The arbiter will now decide.")).toBeVisible();
  expect(await signedCount(page)).toBe(1);

  const dispute = sent.find((call) => call.fn === "dispute");
  expect(dispute?.contract).toBe(ESCROW_CONTRACT);
  expect(scValToNative(dispute!.args[0]!)).toBe(STUB_ADDRESS);

  // The arbiter takes over and resolves 70% to the beneficiary.
  await switchAccount(page, OTHER_ADDRESS);
  await expect(page.getByText("You arbitrate")).toBeVisible();
  await page.getByLabel("Beneficiary split (bps):").fill("7000");
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  const resolveDialog = page.getByRole("dialog");
  await expect(resolveDialog.getByText("70% beneficiary, 30% depositor")).toBeVisible();
  await resolveDialog.getByRole("button", { name: "Resolve dispute" }).click();
  await expect(
    page.getByText("Arbiter decision recorded. Funds split according to the basis-point allocation."),
  ).toBeVisible();
  expect(await signedCount(page)).toBe(2);

  const resolve = sent.find((call) => call.fn === "resolve");
  expect(resolve?.contract).toBe(ESCROW_CONTRACT);
  expect(scValToNative(resolve!.args[0]!)).toBe(7000);
  expect(sent.map((call) => call.fn)).toEqual(["dispute", "resolve"]);
});
