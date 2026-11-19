// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NetworkGuard } from "../src/components/NetworkGuard";
import { NETWORK_PASSPHRASE } from "../src/lib/network";

/**
 * NetworkGuard is the last defence against signing on the wrong network
 * (#437): it wraps every page in the root layout. These pin that no signing
 * action is reachable unless the configured RPC reports the app's network,
 * and that the user is told why. If the guard ever stops withholding the
 * page, the "Pay" button below becomes reachable and these fail.
 */
function Page() {
  return (
    <div>
      <h1>Payroll</h1>
      <button type="button">Pay 3</button>
    </div>
  );
}

function rpcReports(passphrase: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { passphrase } }) }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NetworkGuard blocks actions on the wrong network (#437)", () => {
  it("offers the page's actions only once the network matches", async () => {
    rpcReports(NETWORK_PASSPHRASE);
    render(<NetworkGuard><Page /></NetworkGuard>);

    expect(await screen.findByRole("button", { name: "Pay 3" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("withholds every action and explains why when the network does not match", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpcReports("Public Global Stellar Network ; September 2015");
    render(<NetworkGuard><Page /></NetworkGuard>);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not the Stellar testnet/);
    expect(alert).toHaveTextContent(/NEXT_PUBLIC_RPC_URL/);
    expect(screen.queryByRole("button", { name: "Pay 3" })).not.toBeInTheDocument();
  });

  it("does not offer actions while the network is still being checked", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<NetworkGuard><Page /></NetworkGuard>);

    expect(screen.getByText(/Validating testnet connection/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay 3" })).not.toBeInTheDocument();
  });

  it("withholds actions when the network cannot be verified at all", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<NetworkGuard><Page /></NetworkGuard>);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay 3" })).not.toBeInTheDocument();
  });
});
