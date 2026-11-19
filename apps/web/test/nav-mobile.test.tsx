// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

let currentPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({
    address: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    connecting: false,
    error: null,
    networkError: null,
    accountSwitch: null,
  }),
}));

import { Nav } from "../src/components/Nav";

afterEach(() => {
  cleanup();
  currentPathname = "/";
});

describe("Nav mobile menu (#405)", () => {
  it("toggles the menu with aria-expanded pointing at the link list", async () => {
    const user = userEvent.setup();
    render(<Nav />);

    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const menu = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(menu).toContainElement(screen.getByRole("link", { name: "Payroll" }));

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(menu).toHaveClass("nav__menu--open");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and returns focus to the toggle", async () => {
    const user = userEvent.setup();
    render(<Nav />);

    const toggle = screen.getByRole("button", { name: "Menu" });
    await user.click(toggle);
    screen.getByRole("link", { name: "Streams" }).focus();

    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("closes when the route changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Nav />);

    const toggle = screen.getByRole("button", { name: "Menu" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    currentPathname = "/streams";
    rerender(<Nav />);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
