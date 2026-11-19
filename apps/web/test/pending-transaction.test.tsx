// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PendingTransactionBanner, formatElapsed } from "../src/components/PendingTransactionBanner";
import { PENDING_TIMEOUT_MS, usePendingTransaction } from "../src/hooks/usePendingTransaction";

const HASH = "9f2c4a1b7d3e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("usePendingTransaction (#398)", () => {
  it("reports pending with an elapsed counter while the transaction is in flight", () => {
    const { result } = renderHook(() => usePendingTransaction({ pending: true }));
    expect(result.current).toMatchObject({ status: "pending", elapsedSeconds: 0, hash: undefined });

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current).toMatchObject({ status: "pending", elapsedSeconds: 3 });
  });

  it("moves to success with the hash once the transaction resolves", () => {
    const { result, rerender } = renderHook(
      ({ pending, hash }: { pending: boolean; hash?: string }) => usePendingTransaction({ pending, hash }),
      { initialProps: { pending: true, hash: undefined as string | undefined } },
    );

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    rerender({ pending: false, hash: HASH });

    expect(result.current).toMatchObject({ status: "success", hash: HASH, elapsedSeconds: 5 });

    // The elapsed time is frozen once the run has ended.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.elapsedSeconds).toBe(5);
  });

  it("moves to timeout and stays there until the transaction resolves", () => {
    const { result, rerender } = renderHook(
      ({ pending, hash }: { pending: boolean; hash?: string }) => usePendingTransaction({ pending, hash }),
      { initialProps: { pending: true, hash: undefined as string | undefined } },
    );

    act(() => {
      vi.advanceTimersByTime(PENDING_TIMEOUT_MS);
    });
    expect(result.current.status).toBe("timeout");

    // Persistent: still shown well after the timeout, and the counter keeps running.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.status).toBe("timeout");
    expect(result.current.elapsedSeconds).toBe(Math.floor((PENDING_TIMEOUT_MS + 60_000) / 1000));

    // Resolving late turns the timeout into a success.
    rerender({ pending: false, hash: HASH });
    expect(result.current).toMatchObject({ status: "success", hash: HASH });
  });

  it("clears to idle when the run ends without a new hash (a failure)", () => {
    const { result, rerender } = renderHook(
      ({ pending }: { pending: boolean }) => usePendingTransaction({ pending }),
      { initialProps: { pending: true } },
    );
    rerender({ pending: false });
    expect(result.current.status).toBe("idle");
  });

  it("hides for the current run when dismissed, and shows again on the next run", () => {
    const { result, rerender } = renderHook(
      ({ pending, hash }: { pending: boolean; hash?: string }) => usePendingTransaction({ pending, hash }),
      { initialProps: { pending: true, hash: undefined as string | undefined } },
    );
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.status).toBe("idle");

    rerender({ pending: false, hash: HASH });
    expect(result.current.status).toBe("idle");

    rerender({ pending: true, hash: undefined });
    expect(result.current.status).toBe("pending");
  });
});

describe("PendingTransactionBanner (#398)", () => {
  it("renders nothing while idle", () => {
    const { container } = render(
      <PendingTransactionBanner status="idle" elapsedSeconds={0} onDismiss={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the pending state with the elapsed time", () => {
    render(<PendingTransactionBanner status="pending" elapsedSeconds={75} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Transaction pending");
    expect(screen.getByRole("status")).toHaveTextContent("Elapsed 1:15");
  });

  it("shows the success state with the hash", () => {
    render(
      <PendingTransactionBanner status="success" hash={HASH} elapsedSeconds={6} onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Transaction confirmed");
    expect(screen.getByText(HASH)).toBeInTheDocument();
  });

  it("shows the timeout state, which tells the user to check the hash before retrying", () => {
    render(<PendingTransactionBanner status="timeout" elapsedSeconds={45} onDismiss={vi.fn()} />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Still waiting for confirmation");
    expect(banner).toHaveTextContent("check the hash before retrying");
  });

  it("calls onDismiss when the user dismisses it", () => {
    const onDismiss = vi.fn();
    render(<PendingTransactionBanner status="timeout" elapsedSeconds={45} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("formats elapsed time as m:ss and h:mm:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65)).toBe("1:05");
    expect(formatElapsed(3_725)).toBe("1:02:05");
  });
});
