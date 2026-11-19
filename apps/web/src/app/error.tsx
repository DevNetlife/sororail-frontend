"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/reportError";

/**
 * Route error boundary: an uncaught render error in any page lands here
 * instead of a blank screen, and is reported once (#433).
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { source: "error-boundary", digest: error.digest });
  }, [error]);

  return (
    <div className="notice notice--error" role="alert" aria-live="assertive">
      <div className="notice__title">This page failed to load</div>
      <div>Something went wrong. Please try again.</div>
      <div>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
