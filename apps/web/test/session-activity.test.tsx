// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SessionActivityPanel } from "../src/components/SessionActivityPanel";
import { SessionActivityStore, trackSubmit } from "../src/lib/session-activity";

afterEach(cleanup);

const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

/** A fake RPC: reports NOT_FOUND for `pendingPolls` checks, then the final status. */
function fakeRpc(finalStatus: "SUCCESS" | "FAILED", pendingPolls = 1) {
  const calls: string[] = [];
  let remaining = pendingPolls;
  return {
    calls,
    async getTransaction(hash: string) {
      calls.push(hash);
      if (remaining > 0) {
        remaining -= 1;
        return { status: "NOT_FOUND" };
      }
      return { status: finalStatus };
    },
  };
}

describe("trackSubmit", () => {
  it("records the hash and confirmed status when the submission resolves", async () => {
    const store = new SessionActivityStore(null);
    const sent = await trackSubmit("Withdraw", async () => ({ hash: HASH, result: 1 }), store);

    expect(sent.hash).toBe(HASH);
    const [entry] = store.list();
    expect(entry).toMatchObject({ label: "Withdraw", hash: HASH, status: "confirmed" });
  });

  it("marks the entry failed and rethrows when the submission rejects", async () => {
    const store = new SessionActivityStore(null);
    await expect(
      trackSubmit("Cancel", async () => {
        throw new Error("rejected");
      }, store),
    ).rejects.toThrow("rejected");

    expect(store.list()[0]).toMatchObject({ label: "Cancel", hash: null, status: "failed" });
  });

  it("persists to storage and reloads it", async () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    } as unknown as Storage;

    const first = new SessionActivityStore(storage);
    await trackSubmit("Claim", async () => ({ hash: HASH, result: 0 }), first);

    const reloaded = new SessionActivityStore(storage);
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.list()[0]).toMatchObject({ label: "Claim", hash: HASH, status: "confirmed" });
  });

  it("ignores corrupt stored data", () => {
    const storage = {
      getItem: () => "{not json",
      setItem: () => undefined,
    } as unknown as Storage;
    expect(new SessionActivityStore(storage).list()).toEqual([]);
  });
});

describe("SessionActivityPanel", () => {
  it("shows an empty state before anything is submitted", () => {
    render(<SessionActivityPanel store={new SessionActivityStore(null)} source={fakeRpc("SUCCESS")} />);
    expect(screen.getByText(/No transactions submitted/)).toBeInTheDocument();
  });

  it("updates a pending transaction to confirmed as the fake RPC reports success", async () => {
    const store = new SessionActivityStore(null);
    const rpc = fakeRpc("SUCCESS", 1);
    store.update(store.add("Withdraw"), { hash: HASH });

    render(<SessionActivityPanel store={store} source={rpc} pollMs={10} />);

    expect(screen.getByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Confirmed")).toBeInTheDocument());
    expect(rpc.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows a failed transaction when the fake RPC reports FAILED", async () => {
    const store = new SessionActivityStore(null);
    store.update(store.add("Extend"), { hash: HASH });

    render(<SessionActivityPanel store={store} source={fakeRpc("FAILED", 0)} pollMs={10} />);

    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
  });

  it("re-renders when a new submission is recorded", async () => {
    const store = new SessionActivityStore(null);
    render(<SessionActivityPanel store={store} source={fakeRpc("SUCCESS")} />);

    await act(async () => {
      await trackSubmit("Top up", async () => ({ hash: HASH, result: 0 }), store);
    });

    expect(screen.getByText("Top up")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });
});
