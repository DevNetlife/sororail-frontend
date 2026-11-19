// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../src/components/ToastProvider";
import { useToast } from "../src/hooks/useToast";

function Trigger() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.success("Saved")}>
        Save
      </button>
      <button type="button" onClick={() => toast.error("Could not save")}>
        Fail
      </button>
      <button type="button" onClick={() => toast.success("Also saved")}>
        Save again
      </button>
    </>
  );
}

function renderWithToasts() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("toast announcements (#396)", () => {
  it("announces success with a polite status role", () => {
    renderWithToasts();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Saved");
  });

  it("announces errors with an assertive alert role", () => {
    renderWithToasts();
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Could not save");
  });
});

describe("toast auto-dismiss timers (#396)", () => {
  it("removes a success toast after 5 seconds", () => {
    renderWithToasts();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    advance(4_999);
    expect(screen.getByRole("status")).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps an error toast for 8 seconds", () => {
    renderWithToasts();
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));

    advance(7_999);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("pauses the countdown while hovered and resumes the time left on leave", () => {
    renderWithToasts();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const status = screen.getByRole("status");

    advance(2_000);
    fireEvent.mouseEnter(status);
    advance(60_000);
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.mouseLeave(status);
    advance(2_999);
    expect(screen.getByRole("status")).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("pauses the countdown while focus is inside the toast", () => {
    renderWithToasts();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const dismissButton = screen.getByRole("button", { name: "Dismiss notification" });

    advance(3_000);
    act(() => dismissButton.focus());
    advance(60_000);
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => dismissButton.blur());
    advance(1_999);
    expect(screen.getByRole("status")).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("toast keyboard dismissal (#396)", () => {
  it("dismisses on Escape while the toast has focus", () => {
    renderWithToasts();
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));
    const alert = screen.getByRole("alert");

    fireEvent.keyDown(alert, { key: "Escape" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("dismisses from the close button", () => {
    renderWithToasts();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("useToast", () => {
  it("throws outside a ToastProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow("useToast must be used inside <ToastProvider>.");
    consoleError.mockRestore();
  });
});
