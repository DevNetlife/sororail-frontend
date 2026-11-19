// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NetworkBadge } from "../src/components/NetworkBadge";
import { NETWORK_GUARD_HELP } from "../src/components/NetworkGuard";
import { NETWORK_PASSPHRASE } from "../src/lib/network";
import { networkName } from "../src/lib/network-name";

afterEach(() => cleanup());

describe("NetworkBadge (#429)", () => {
  it("names testnet for the configured passphrase", () => {
    render(<NetworkBadge passphrase={NETWORK_PASSPHRASE} />);
    const badge = screen.getByTestId("network-badge");
    expect(badge).toHaveTextContent("Testnet");
    expect(badge).not.toHaveClass("pill--warn");
  });

  it("defaults to the configured passphrase", () => {
    render(<NetworkBadge />);
    expect(screen.getByTestId("network-badge")).toHaveTextContent("Testnet");
  });

  it("warns on an unknown passphrase and links to the guard's help text", () => {
    render(<NetworkBadge passphrase="Some Private Network ; 2026" />);
    const badge = screen.getByTestId("network-badge");
    expect(badge).toHaveTextContent("Unknown network");
    expect(badge).toHaveClass("pill--warn");
    expect(badge).toHaveAttribute("title", NETWORK_GUARD_HELP);
  });

  it("warns on a known but unsupported network", () => {
    render(<NetworkBadge passphrase="Public Global Stellar Network ; September 2015" />);
    const badge = screen.getByTestId("network-badge");
    expect(badge).toHaveTextContent("Mainnet");
    expect(badge).toHaveClass("pill--warn");
  });

  it("knows the well-known passphrases", () => {
    expect(networkName("Test SDF Network ; September 2015")).toBe("Testnet");
    expect(networkName("nope")).toBeNull();
  });
});
