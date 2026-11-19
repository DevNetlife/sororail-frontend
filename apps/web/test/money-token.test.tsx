// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// #411 — Money shows the token's own symbol (name in the tooltip); a failed read degrades to the contract id.
const mocks = vi.hoisted(() => ({ fetchTokenMetadata: vi.fn() }));

vi.mock("@/lib/token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/token")>();
  return { ...actual, fetchTokenMetadata: mocks.fetchTokenMetadata };
});

import { Money } from "../src/components/Money";

const USDC = "CUSDCTOKENCONTRACTIDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAAAA";
const EURC = "CEURCTOKENCONTRACTIDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXBBBB";
const BROKEN = "CBROKENCONTRACTIDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXCCCC";

afterEach(() => {
  cleanup();
  mocks.fetchTokenMetadata.mockReset();
});

describe("Money with a token (#411)", () => {
  it("renders each token's symbol, with its name as the tooltip", async () => {
    mocks.fetchTokenMetadata.mockImplementation(async (id: string) =>
      id === USDC
        ? { symbol: "USDC", name: "USD Coin", decimals: 7 }
        : { symbol: "EURC", name: "Euro Coin", decimals: 7 },
    );
    render(
      <>
        <Money value={10_000_000n} token={USDC} />
        <Money value={20_000_000n} token={EURC} />
      </>,
    );
    expect(await screen.findByText("USDC")).toHaveAttribute("title", "USD Coin");
    expect(await screen.findByText("EURC")).toHaveAttribute("title", "Euro Coin");
  });

  it("degrades to the shortened contract id when the read fails", async () => {
    mocks.fetchTokenMetadata.mockRejectedValue(new Error("rpc down"));
    render(<Money value={10_000_000n} token={BROKEN} />);
    const unit = await screen.findByTitle(BROKEN);
    expect(unit).toHaveTextContent("CBRO…CCCC");
  });

  it("keeps the plain unit when no token is given", () => {
    render(<Money value={10_000_000n} unit="XLM" />);
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(mocks.fetchTokenMetadata).not.toHaveBeenCalled();
  });
});
