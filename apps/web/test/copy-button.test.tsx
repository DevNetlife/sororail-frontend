// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "@/components/CopyButton";

afterEach(cleanup);

describe("CopyButton", () => {
  it("renders a Copy button", () => {
    render(<CopyButton text="CABC123" />);
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
  });

  it("announces success via live region after copy", async () => {
    const user = userEvent.setup();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<CopyButton text="CABC123" />);
    await user.click(screen.getByRole("button"));
    const live = screen.getByRole("status");
    expect(live.textContent).toContain("Copied");
  });

  it("uses a custom label as the button accessible name", () => {
    render(<CopyButton text="CABC123" label="Copy contract" />);
    expect(screen.getByRole("button", { name: /copy contract/i })).toBeTruthy();
  });

  it("renders an empty live region before copying", () => {
    render(<CopyButton text="CABC123" />);
    const live = screen.getByRole("status");
    expect(live.textContent).toBe("");
  });
});
