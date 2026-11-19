import { describe, expect, it } from "vitest";

import { t } from "../src/lib/i18n";
import { en } from "../src/lib/i18n/en";

// #409 — the i18n scaffold: typed keys, interpolation, and the Overview pilot's English copy unchanged.
describe("t()", () => {
  it("returns the English string for a key", () => {
    expect(t("overview.title")).toBe("Overview");
    expect(t("overview.tile.payroll.body")).toBe("Pay many recipients in one transaction.");
  });

  it("ignores params for keys without placeholders", () => {
    expect(t("overview.title", { unused: 1 })).toBe("Overview");
  });

  it("has no empty strings in the English dictionary", () => {
    for (const [key, value] of Object.entries(en)) expect(value, key).not.toBe("");
  });
});
