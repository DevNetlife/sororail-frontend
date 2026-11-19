import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  exportPositions,
  importPositions,
  MAX_IMPORT_SIZE,
} from "../src/lib/positions";
import { makePosition } from "./fixtures";

const OTHER_ADDRESS = "CZYXWVUTSRQPONMLKJIHGFEDCBA765432ZYXWVUTSRQPONMLKJIHGFED";

describe("position backup import (#443)", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
      dispatchEvent: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects a file over the size limit before parsing it", () => {
    const huge = `[${" ".repeat(MAX_IMPORT_SIZE)}]`;
    const parse = vi.spyOn(JSON, "parse");
    expect(() => importPositions(huge)).toThrow(/too large/);
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("rejects a backup from a newer schema version with a precise message", () => {
    const json = JSON.stringify({ version: 99, positions: [makePosition()] });
    expect(() => importPositions(json)).toThrow(/schema version 99.*reads up to version/);
  });

  it("rejects a backup with a missing or malformed version", () => {
    expect(() => importPositions(JSON.stringify({ positions: [makePosition()] }))).toThrow(/no valid version/);
    expect(() => importPositions(JSON.stringify({ version: "2", positions: [] }))).toThrow(/no valid version/);
    expect(() => importPositions(JSON.stringify({ version: 1.5, positions: [] }))).toThrow(/no valid version/);
  });

  it("rejects a versioned backup whose positions are not an array", () => {
    expect(() => importPositions(JSON.stringify({ version: 2, positions: {} }))).toThrow(/array of positions/);
  });

  it("imports a valid versioned backup", () => {
    const json = JSON.stringify({ version: 2, positions: [makePosition()] });
    expect(importPositions(json)).toEqual({ added: 1, skipped: 0 });
  });

  it("upgrades a version 1 backup by filling in the network", () => {
    const v1: Record<string, unknown> = { ...makePosition({ contractId: OTHER_ADDRESS }) };
    delete v1["network"];
    const json = JSON.stringify({ version: 1, positions: [v1] });
    expect(importPositions(json)).toEqual({ added: 1, skipped: 0 });
  });

  it("still accepts a legacy bare-array backup", () => {
    expect(importPositions(JSON.stringify([makePosition()]))).toEqual({ added: 1, skipped: 0 });
  });

  it("round-trips through exportPositions", () => {
    importPositions(JSON.stringify([makePosition()]));
    const exported = JSON.parse(exportPositions()) as { version: number; positions: unknown[] };
    expect(exported.version).toBe(2);
    expect(exported.positions).toHaveLength(1);
    expect(importPositions(JSON.stringify(exported))).toEqual({ added: 0, skipped: 1 });
  });
});
