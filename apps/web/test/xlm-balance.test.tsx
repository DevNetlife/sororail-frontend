// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { XlmBalance } from "../src/components/XlmBalance";
import { isLowBalance } from "../src/lib/xlm-balance";

afterEach(() => cleanup());

const ADDRESS = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

describe("XlmBalance (#400)", () => {
  it("shows the balance without a warning above the threshold", async () => {
    render(<XlmBalance address={ADDRESS} load={async () => 50} />);
    expect(await screen.findByTestId("xlm-balance")).toHaveTextContent("50 XLM");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("warns with a friendbot link below the threshold", async () => {
    render(<XlmBalance address={ADDRESS} load={async () => 0.5} />);
    const warning = await screen.findByRole("status");
    expect(warning).toHaveAttribute("href", expect.stringContaining("friendbot"));
  });

  it("compares against the threshold", () => {
    expect(isLowBalance(1, 2)).toBe(true);
    expect(isLowBalance(3, 2)).toBe(false);
  });
});
