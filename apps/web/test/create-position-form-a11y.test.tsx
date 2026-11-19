// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const VALID_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const VALID_ACCOUNT_ID = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ address: VALID_ACCOUNT_ID, signer: { sign: vi.fn() } }),
}));

vi.mock("@/lib/positions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/positions")>();
  return { ...actual, addPosition: vi.fn(() => true) };
});

import { CreatePositionForm } from "../src/components/CreatePositionForm";

afterEach(() => {
  cleanup();
});

describe("CreatePositionForm field errors are announced (#408)", () => {
  it("links each error to its input and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="stream" />);

    await user.click(screen.getByRole("button", { name: "Create a stream" }));

    const contract = screen.getByLabelText("Deployed contract address");
    expect(contract).toHaveAttribute("aria-invalid", "true");
    const errorId = contract.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent("Contract address is required.");
    expect(contract).toHaveFocus();

    const name = screen.getByLabelText("Name (optional)");
    expect(name).toHaveAttribute("aria-invalid", "false");
    expect(name).not.toHaveAttribute("aria-describedby");
  });

  it("moves focus to the first field that is still invalid", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="stream" />);

    await user.type(screen.getByLabelText("Deployed contract address"), VALID_CONTRACT_ID);
    await user.click(screen.getByRole("button", { name: "Create a stream" }));

    const contract = screen.getByLabelText("Deployed contract address");
    expect(contract).toHaveAttribute("aria-invalid", "false");
    expect(contract).not.toHaveAttribute("aria-describedby");

    const recipient = screen.getByLabelText("Recipient address");
    expect(recipient).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(recipient.getAttribute("aria-describedby")!)).toHaveTextContent(
      "Recipient address is required.",
    );
    expect(recipient).toHaveFocus();
  });
});
