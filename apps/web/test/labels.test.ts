// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MAX_LABEL_LENGTH,
  addPosition,
  importPositions,
  renamePosition,
  sanitizeLabel,
} from "../src/lib/positions";
import { RPC_URL } from "../src/lib/network";

// #444: labels come from user input and imported JSON, and also reach `title`
// attributes and file names, so they are cleaned wherever they enter.

const ID = "CA" + "A".repeat(54);
const OTHER = "CB" + "B".repeat(54);

/** The registry as persisted (listPositions memoises between subscriber notifications). */
const stored = (): { contractId: string; label: string }[] =>
  JSON.parse(window.localStorage.getItem("sororail.positions.v2") ?? "[]");

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("sanitizeLabel (#444)", () => {
  it("strips control characters and collapses whitespace", () => {
    expect(sanitizeLabel("Pay\u0000roll\u0007 \u001b[31mred\u007f")).toBe("Pay roll [31mred");
    expect(sanitizeLabel("  line\none\r\ttwo  ")).toBe("line one two");
  });

  it("strips bidi overrides that could reorder what the user sees", () => {
    expect(sanitizeLabel("invoice\u202efdp.exe")).toBe("invoice fdp.exe");
    expect(sanitizeLabel("\u2066isolated\u2069")).toBe("isolated");
  });

  it("limits a 10k-character label to the maximum length", () => {
    const out = sanitizeLabel("x".repeat(10_000));
    expect(Array.from(out)).toHaveLength(MAX_LABEL_LENGTH);
  });

  it("never splits a character when cutting", () => {
    const out = sanitizeLabel("😀".repeat(200));
    expect(Array.from(out)).toHaveLength(MAX_LABEL_LENGTH);
    expect(out).toBe("😀".repeat(MAX_LABEL_LENGTH));
  });

  it("returns an empty string when nothing printable is left", () => {
    expect(sanitizeLabel("\u0000\u0001 \u202e ")).toBe("");
  });
});

describe("labels are cleaned on add, rename and import (#444)", () => {
  it("cleans on add, and falls back to the contract ID when nothing is left", () => {
    addPosition("stream", ID, "Rent\u0000 stream");
    addPosition("stream", OTHER, "\u0007\u0008");
    const labels = Object.fromEntries(stored().map((p) => [p.contractId, p.label]));
    expect(labels[ID]).toBe("Rent stream");
    expect(labels[OTHER]).toBe(OTHER);
  });

  it("cleans on rename, and ignores a rename to nothing printable", () => {
    addPosition("stream", ID, "Original");
    renamePosition(ID, "y".repeat(10_000));
    expect(stored()[0]!.label).toBe("y".repeat(MAX_LABEL_LENGTH));
    renamePosition(ID, "\u0000\u202e");
    expect(stored()[0]!.label).toBe("y".repeat(MAX_LABEL_LENGTH));
  });

  it("cleans labels in an imported file, including 10k-character ones", () => {
    const file = JSON.stringify([
      { kind: "vesting", contractId: ID, label: "Grant\u0000\u202e\n" + "z".repeat(10_000), addedAt: 1, network: RPC_URL },
      { kind: "escrow", contractId: OTHER, label: "\u0001", addedAt: 2, network: RPC_URL },
    ]);
    expect(importPositions(file)).toEqual({ added: 2, skipped: 0 });
    const byId = Object.fromEntries(stored().map((p) => [p.contractId, p.label]));
    expect(Array.from(byId[ID]!)).toHaveLength(MAX_LABEL_LENGTH);
    expect(byId[ID]!.startsWith("Grant z")).toBe(true);
    expect(byId[ID]).not.toMatch(/[\u0000-\u001f\u202e]/);
    expect(byId[OTHER]).toBe(OTHER);
  });
});
