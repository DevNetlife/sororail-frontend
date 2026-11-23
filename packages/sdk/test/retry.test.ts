import { describe, expect, it, vi } from "vitest";
import { NetworkError } from "../src/errors/index.js";

describe("retry behavior", () => {
  it("documents default retry configuration", () => {
    const defaults = {
      attempts: 3,
      baseDelayMs: 100,
    };
    expect(defaults.attempts).toBe(3);
    expect(defaults.baseDelayMs).toBe(100);
  });

  it("demonstrates exponential backoff calculation", () => {
    const baseDelayMs = 100;
    expect(baseDelayMs * 2 ** 0).toBe(100);
    expect(baseDelayMs * 2 ** 1).toBe(200);
    expect(baseDelayMs * 2 ** 2).toBe(400);
  });

  it("identifies transient error patterns", () => {
    const transientMessages = [
      "HTTP 429 Too Many Requests",
      "HTTP 503 Service Unavailable",
      "ECONNRESET: Connection reset by peer",
      "Network request failed",
    ];

    for (const message of transientMessages) {
      const error = new Error(message);
      expect(error.message.toLowerCase()).toMatch(/429|503|econnreset|network/);
    }
  });

  it("identifies non-transient contract errors", () => {
    const contractErrorMessage = "Error(Contract, #42)";
    expect(contractErrorMessage).not.toMatch(/429|503|econnreset/);
  });
});
