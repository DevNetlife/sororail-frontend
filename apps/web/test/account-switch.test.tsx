// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FIRST = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SECOND = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** What Freighter currently reports as the active account. */
let activeAccount = FIRST;

function signerFor(publicKey: string) {
  return {
    publicKey,
    currentAddress: vi.fn(async () => activeAccount),
    assertNetwork: vi.fn().mockResolvedValue(undefined),
  };
}

const mockFreighterConnect = vi.fn(async () => signerFor(activeAccount));

vi.mock("@sororail/sdk", () => ({
  FreighterSigner: { connect: mockFreighterConnect },
  SigningError: class SigningError extends Error {},
  NetworkMismatchError: class NetworkMismatchError extends Error {},
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { Nav } from "../src/components/Nav";
import { useWallet, WalletProvider } from "../src/lib/wallet";

function renderWithNav() {
  let captured: ReturnType<typeof useWallet> | null = null;
  function Consumer() {
    captured = useWallet();
    return null;
  }
  render(
    <WalletProvider>
      <Nav />
      <Consumer />
    </WalletProvider>,
  );
  return () => captured!;
}

describe("Freighter account switch notice (#430)", () => {
  beforeEach(() => {
    activeAccount = FIRST;
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("drops the signer and shows a notice when the active account changes", async () => {
    const getState = renderWithNav();
    await waitFor(() => expect(getState().address).toBe(FIRST));

    activeAccount = SECOND;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(getState().address).toBeNull());
    expect(getState().signer).toBeNull();
    expect(getState().accountSwitch).toEqual({ previous: FIRST, current: SECOND });
    expect(screen.getByText("Freighter account changed")).toBeInTheDocument();
  });

  it("reconnects as the new account in one click and clears the notice", async () => {
    const getState = renderWithNav();
    await waitFor(() => expect(getState().address).toBe(FIRST));

    activeAccount = SECOND;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    const reconnect = await screen.findByRole("button", { name: /^Reconnect as / });

    await userEvent.click(reconnect);

    await waitFor(() => expect(getState().address).toBe(SECOND));
    expect(getState().accountSwitch).toBeNull();
    expect(screen.queryByText("Freighter account changed")).not.toBeInTheDocument();
  });

  it("does nothing while the active account stays the same", async () => {
    const getState = renderWithNav();
    await waitFor(() => expect(getState().address).toBe(FIRST));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(getState().address).toBe(FIRST);
    expect(getState().accountSwitch).toBeNull();
  });
});
