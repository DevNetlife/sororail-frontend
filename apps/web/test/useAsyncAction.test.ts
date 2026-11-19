// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAsyncAction } from "../src/hooks/useAsyncAction";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
});

describe("useAsyncAction (#440)", () => {
  it("is busy while running and exposes the result", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() => useAsyncAction(() => d.promise));

    expect(result.current.busy).toBe(false);
    let pending!: Promise<string | undefined>;
    act(() => {
      pending = result.current.run();
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      d.resolve("hash-1");
      await pending;
    });
    expect(result.current).toMatchObject({ busy: false, error: null, result: "hash-1" });
  });

  it("stores a failure instead of rejecting", async () => {
    const failure = new Error("rejected by wallet");
    const { result } = renderHook(() => useAsyncAction(async () => { throw failure; }));

    let returned: unknown = "unset";
    await act(async () => {
      returned = await result.current.run();
    });
    expect(returned).toBeUndefined();
    expect(result.current).toMatchObject({ busy: false, error: failure, result: undefined });
  });

  it("passes arguments through and keeps run stable across renders", async () => {
    const action = vi.fn(async (a: number, b: number) => a + b);
    const { result, rerender } = renderHook(() => useAsyncAction(action));
    const first = result.current.run;
    rerender();
    expect(result.current.run).toBe(first);

    await act(async () => {
      await result.current.run(2, 3);
    });
    expect(action).toHaveBeenCalledWith(2, 3);
    expect(result.current.result).toBe(5);
  });

  it("ignores an earlier call that finishes after a newer one", async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const calls = [slow, fast];
    const { result } = renderHook(() => useAsyncAction(() => calls.shift()!.promise));

    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => {
      a = result.current.run();
      b = result.current.run();
    });
    await act(async () => {
      fast.resolve("new");
      await b;
    });
    await act(async () => {
      slow.resolve("old");
      await a;
    });
    expect(result.current.result).toBe("new");
  });

  it("does not update state after unmounting mid-flight", async () => {
    const d = deferred<string>();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useAsyncAction(() => d.promise));

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.run();
    });
    const lastSeen = result.current;
    unmount();
    d.resolve("late");
    await pending;

    expect(lastSeen.busy).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("reset clears the error", async () => {
    const { result } = renderHook(() => useAsyncAction(async () => { throw new Error("x"); }));
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBeInstanceOf(Error);
    act(() => result.current.reset());
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
