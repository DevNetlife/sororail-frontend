"use client";

import { useState } from "react";

/**
 * Copies `text` to the clipboard.
 *
 * A polite ARIA live region announces success to screen-reader users without
 * an intrusive alert. Clipboard errors are silently swallowed so the caller
 * stays functional even when the Clipboard API is unavailable.
 */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable; silently fail — the user can select and copy.
    }
  }

  return (
    <>
      <button
        type="button"
        className="button--quiet"
        aria-label={copied ? "Copied to clipboard" : label}
        onClick={() => void copy()}
      >
        {copied ? "✓" : "Copy"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
