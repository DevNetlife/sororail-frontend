// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWallet, WalletProvider } from "../src/lib/wallet";

/**
 * Reconnect-on-load (#436). A wallet that was connected before reconnects
 * silently when the app loads; one the user explicitly disconnected stays
 * disconnected across reloads. Freighter is mocked through @sororail/sdk.
 */
const PUBLIC_KEY = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX";
const DISCONNECTED_KEY = "sororail:wallet-disconnected";

const mockSigner = {
  publicKey: PUBLIC_KEY,
  currentAddress: vi.fn().mockResolvedValue(PUBLIC_KEY),
  assertNetwork: vi.fn().mockResolvedValue(undefined),
};
const mockFreighterConnect = vi.fn();

vi.mock("@sororail/sdk", () => ({
  FreighterSigner: { connect: mockFreighterConnect },
  SigningError: class SigningError extends Error {},
  NetworkMismatchError: class NetworkMismatchError extends Error {},
}));

function renderWallet() {
  let captured: ReturnType<typeof useWallet> | null = null;
  function Consumer() {
    captured = useWallet();
    return null;
  }
  render(
    <WalletProvider>
      <Consumer />
    </WalletProvider>,
  );
  return () => captured!;
}

/** Lets the provider's async restore effect settle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  mockFreighterConnect.mockResolvedValue(mockSigner);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("wallet reconnect on load (#436)", () => {
  it("silently restores a previously connected wallet without the user clicking Connect", async () => {
    const getState = renderWallet();

    await waitFor(() => expect(getState().address).toBe(PUBLIC_KEY));
    expect(mockFreighterConnect).toHaveBeenCalledTimes(1);
    expect(getState().error).toBeNull();
    expect(getState().connecting).toBe(false);
  });

  it("does not reconnect after an explicit disconnect, including on the next load", async () => {
    const first = renderWallet();
    await waitFor(() => expect(first().address).toBe(PUBLIC_KEY));

    act(() => first().disconnect());
    expect(first().address).toBeNull();
    expect(window.localStorage.getItem(DISCONNECTED_KEY)).toBe("1");

    // A reload: a fresh provider reading the persisted choice.
    cleanup();
    mockFreighterConnect.mockClear();
    const second = renderWallet();
    await flush();

    expect(mockFreighterConnect).not.toHaveBeenCalled();
    expect(second().address).toBeNull();
  });
});
