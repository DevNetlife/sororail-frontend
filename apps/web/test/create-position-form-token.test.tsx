// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// #412 — the token selector reads and previews a pasted token's symbol, name and decimals.
const mocks = vi.hoisted(() => ({ fetchTokenMetadata: vi.fn() }));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ address: undefined, signer: undefined }),
}));

vi.mock("@/lib/token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/token")>();
  return { ...actual, fetchTokenMetadata: mocks.fetchTokenMetadata };
});

import { CreatePositionForm } from "../src/components/CreatePositionForm";
import { BATCH_PAYOUT_CONTRACT } from "../src/lib/network";
import { NotATokenError } from "../src/lib/token";

const OTHER_CONTRACT = BATCH_PAYOUT_CONTRACT;

async function pasteToken(value: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Token contract address");
  await user.clear(input);
  await user.click(input);
  await user.paste(value);
}

afterEach(() => {
  cleanup();
  mocks.fetchTokenMetadata.mockReset();
});

describe("CreatePositionForm token selector (#412)", () => {
  it("defaults to the native token without any read", () => {
    render(<CreatePositionForm kind="stream" />);
    expect(screen.getByTestId("token-preview")).toHaveTextContent("XLM · Stellar Lumens (native) · 7 decimals");
    expect(mocks.fetchTokenMetadata).not.toHaveBeenCalled();
  });

  it("shows a loading state while the pasted token is read", async () => {
    mocks.fetchTokenMetadata.mockReturnValue(new Promise(() => {}));
    render(<CreatePositionForm kind="vesting" />);
    await pasteToken(OTHER_CONTRACT);
    expect(await screen.findByRole("status")).toHaveTextContent("Reading token details");
    expect(mocks.fetchTokenMetadata).toHaveBeenCalledWith(OTHER_CONTRACT, expect.anything());
  });

  it("previews symbol, name and decimals for a token", async () => {
    mocks.fetchTokenMetadata.mockResolvedValue({ symbol: "USDC", name: "USD Coin", decimals: 6 });
    render(<CreatePositionForm kind="escrow" />);
    await pasteToken(OTHER_CONTRACT);
    expect(await screen.findByTestId("token-preview")).toHaveTextContent("USDC · USD Coin · 6 decimals");
  });

  it("shows a clear error for a contract that is not a token", async () => {
    mocks.fetchTokenMetadata.mockRejectedValue(new NotATokenError("no symbol()"));
    render(<CreatePositionForm kind="stream" />);
    await pasteToken(OTHER_CONTRACT);
    expect(await screen.findByRole("alert")).toHaveTextContent("it is not a token");
  });
});
