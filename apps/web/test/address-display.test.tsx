// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/network", () => ({
  shortAddress: (addr: string, chars: number) =>
    `${addr.slice(0, chars)}…${addr.slice(-chars)}`,
  explorerContract: (id: string) =>
    id.startsWith("C")
      ? `https://explorer.example.com/contract/${id}`
      : null,
}));

import { Address } from "@/components/Money";

afterEach(cleanup);

const ADDR = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI";

describe("Address", () => {
  it("shows a shortened address for sighted users", () => {
    render(<Address value={ADDR} />);
    expect(screen.getByText(/CAAAAA.*AAAAI/)).toBeTruthy();
  });

  it("includes the full address for screen readers", () => {
    render(<Address value={ADDR} />);
    expect(screen.getByText(ADDR)).toBeTruthy();
  });

  it("renders a CopyButton", () => {
    render(<Address value={ADDR} />);
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
  });

  it("shows an explorer link when explorer=true", () => {
    render(<Address value={ADDR} explorer />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toContain(ADDR);
  });

  it("shows no explorer link when explorer=false (default)", () => {
    render(<Address value={ADDR} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("uses an explicit href when provided", () => {
    render(<Address value={ADDR} href="https://example.com/custom" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://example.com/custom");
  });
});
