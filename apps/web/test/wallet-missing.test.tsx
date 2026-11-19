// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WalletMissingNotice } from "../src/components/ReadOnly";
import { FREIGHTER_INSTALL_URL, hasWalletExtension } from "../src/lib/walletExtension";

type WithApi = { freighterApi?: unknown };

afterEach(() => {
  cleanup();
  delete (window as WithApi).freighterApi;
});

describe("no wallet extension (#445)", () => {
  it("detects whether the wallet API is present", () => {
    expect(hasWalletExtension()).toBe(false);
    (window as WithApi).freighterApi = {};
    expect(hasWalletExtension()).toBe(true);
  });

  it("explains how to install a wallet and that the app still works read-only", () => {
    render(<WalletMissingNotice />);

    expect(screen.getByText("No Stellar wallet found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Freighter" });
    expect(link).toHaveAttribute("href", FREIGHTER_INSTALL_URL);
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText(/works read-only/)).toBeInTheDocument();
  });

  it("shows nothing when the wallet API is present", () => {
    (window as WithApi).freighterApi = {};
    render(<WalletMissingNotice />);
    expect(screen.queryByText("No Stellar wallet found")).not.toBeInTheDocument();
  });

  it("hides itself once an extension appears and the tab regains focus", () => {
    render(<WalletMissingNotice />);
    expect(screen.getByText("No Stellar wallet found")).toBeInTheDocument();

    (window as WithApi).freighterApi = {};
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.queryByText("No Stellar wallet found")).not.toBeInTheDocument();
  });
});
