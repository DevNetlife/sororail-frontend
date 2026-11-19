// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PayrollPage from "../src/app/payroll/page";

const ADDRESS = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const A = `G${"A".repeat(55)}`;
const B = `G${"B".repeat(55)}`;
const C = `G${"C".repeat(55)}`;

const maxRecipients = vi.fn();
const preview = vi.fn();
const execute = vi.fn();
const fetchTokenDecimals = vi.hoisted(() => vi.fn());
const signTransaction = vi.hoisted(() => vi.fn(async (xdr: string) => `signed:${xdr}`));

vi.mock("@sororail/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sororail/sdk")>();
  class BatchPayoutClient {
    static chunk = actual.BatchPayoutClient.chunk;
    maxRecipients = maxRecipients;
    preview = preview;
    execute = execute;
  }
  class SigningError extends Error {}
  return { ...actual, BatchPayoutClient, SigningError };
});

vi.mock("@/lib/token", () => ({ fetchTokenDecimals }));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({
    address: ADDRESS,
    signer: { publicKey: ADDRESS, signTransaction },
    connect: vi.fn(),
  }),
}));

type Call = { recipients: { to: string }[] };

beforeEach(() => {
  window.localStorage.clear();
  // One recipient per batch, so three rows make three transactions.
  maxRecipients.mockResolvedValue(1);
  fetchTokenDecimals.mockResolvedValue(7);
  let attempt = 0;
  execute.mockImplementation(async ({ recipients }: Call) => ({
    signAndSend: async (signer: { signTransaction: (xdr: string, o: object) => Promise<string> }) => {
      attempt += 1;
      await signer.signTransaction("xdr", { networkPassphrase: "test" });
      // The second batch fails the first time it is sent, then succeeds on retry.
      if (recipients[0]!.to === B && attempt === 2) throw new Error("Batch rejected by the network");
      return { hash: `${recipients[0]!.to.slice(0, 2)}hash${attempt}`.padEnd(64, "0"), result: { count: recipients.length } };
    },
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function states() {
  const region = screen.getByRole("region", { name: "Batch progress" });
  return within(region)
    .getAllByRole("listitem")
    .map((item) => item.getAttribute("data-state"));
}

describe("payroll chunk progress (#422)", () => {
  it("shows per-batch status with the second of three failing, and retries only that batch onward", async () => {
    const user = userEvent.setup();
    render(<PayrollPage />);

    fireEvent.change(screen.getByLabelText("Payroll CSV data"), {
      target: { value: `${A},1\n${B},2\n${C},3` },
    });
    const pay = await screen.findByRole("button", { name: "Pay 3" });
    await waitFor(() => expect(pay).not.toBeDisabled());
    await user.click(pay);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Pay 3" }));

    await within(dialog).findByText("Failed");
    expect(states()).toEqual(["confirmed", "failed", "pending"]);
    expect(within(dialog).getByText(/1 of 3 batches confirmed/)).toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(2);
    // Each batch was signed before it was sent.
    expect(signTransaction).toHaveBeenCalledTimes(2);

    await user.click(within(dialog).getByRole("button", { name: "Retry batch 2" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(states()).toEqual(["confirmed", "confirmed", "confirmed"]);
    expect(screen.getByText(/3 of 3 batches confirmed/)).toBeInTheDocument();
    // The first batch was not re-sent: one call for it, two for batch 2, one for batch 3.
    expect(execute.mock.calls.map(([call]) => (call as Call).recipients[0]!.to)).toEqual([A, B, B, C]);
  });
});
