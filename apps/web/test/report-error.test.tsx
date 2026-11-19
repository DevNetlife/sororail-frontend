// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import RouteError from "../src/app/error";
import { ErrorNotice } from "../src/components/Feedback";
import { reportError, setErrorReporter } from "../src/lib/reportError";

afterEach(() => {
  cleanup();
  setErrorReporter(null);
  vi.restoreAllMocks();
});

describe("reportError (#433)", () => {
  it("defaults to console.error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");

    reportError(error, { source: "test" });

    expect(consoleError).toHaveBeenCalledWith("[sororail] test", error, { source: "test" });
  });

  it("sends a failed action shown by ErrorNotice to a custom reporter, once", () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const error = new Error("send failed");

    const { rerender } = render(<ErrorNotice error={error} />);
    rerender(<ErrorNotice error={error} />);

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(error, { source: "ErrorNotice" });
  });

  it("does not report when there is no error", () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);

    render(<ErrorNotice error={null} />);

    expect(reporter).not.toHaveBeenCalled();
  });

  it("reports render failures caught by the route error boundary", async () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const reset = vi.fn();
    const error = Object.assign(new Error("render failed"), { digest: "abc" });

    render(<RouteError error={error} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reporter).toHaveBeenCalledWith(error, { source: "error-boundary", digest: "abc" });
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("never lets a throwing reporter break the UI", () => {
    setErrorReporter(() => {
      throw new Error("reporter down");
    });

    expect(() => render(<ErrorNotice error={new Error("boom")} />)).not.toThrow();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
