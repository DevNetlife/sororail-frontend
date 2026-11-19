/**
 * Client error reporting (#433).
 *
 * One seam for production error visibility: everything the app shows as a
 * failure goes through `reportError`, so wiring a vendor (Sentry, LogRocket,
 * an in-house endpoint) is a single `setErrorReporter` call at start-up
 * instead of edits across every page. The default writes to `console.error`.
 *
 * Reporters must not throw; if one does, the error is swallowed so a broken
 * reporter can never break the screen that was trying to show a failure.
 */

export interface ErrorContext {
  /** Where the failure surfaced, e.g. `"ErrorNotice"` or `"error-boundary"`. */
  source: string;
  [key: string]: unknown;
}

export type ErrorReporter = (error: unknown, context: ErrorContext) => void;

export const consoleReporter: ErrorReporter = (error, context) => {
  console.error(`[sororail] ${context.source}`, error, context);
};

let current: ErrorReporter = consoleReporter;

/** Installs a reporter; `null` restores the `console.error` default. */
export function setErrorReporter(reporter: ErrorReporter | null): void {
  current = reporter ?? consoleReporter;
}

export function reportError(error: unknown, context: ErrorContext): void {
  try {
    current(error, context);
  } catch {
    // A failing reporter must not take the UI down with it.
  }
}
