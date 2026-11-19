"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Where an unsent payroll CSV is kept between reloads (#421). Only this browser can see it. */
export const PAYROLL_DRAFT_KEY = "sororail.payroll-draft";
export const PAYROLL_DRAFT_DELAY_MS = 750;

// Every access is guarded: storage can be disabled, full, or throw on access in
// private modes, and a draft is a convenience that must never break the page.
function read(): string | null {
  try {
    return window.localStorage.getItem(PAYROLL_DRAFT_KEY);
  } catch {
    return null;
  }
}
function write(value: string): void {
  try {
    window.localStorage.setItem(PAYROLL_DRAFT_KEY, value);
  } catch {
    // Not saved; the in-memory CSV is unaffected.
  }
}
function remove(): void {
  try {
    window.localStorage.removeItem(PAYROLL_DRAFT_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/**
 * Auto-saves the payroll CSV (debounced) and exposes a saved draft from an
 * earlier visit so the page can offer to restore it.
 *
 * An empty textarea only clears storage once it has held content in this
 * session, so the empty field on load (including React's doubled effects in
 * development) never wipes the draft before the operator can restore it.
 */
export function usePayrollDraft(csv: string, delayMs = PAYROLL_DRAFT_DELAY_MS) {
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const hadContent = useRef(false);

  useEffect(() => {
    const draft = read();
    if (draft && draft.trim()) setSavedDraft(draft);
  }, []);

  useEffect(() => {
    const hasContent = csv.trim().length > 0;
    if (!hasContent && !hadContent.current) return;
    if (hasContent) hadContent.current = true;
    const timer = setTimeout(() => {
      if (hasContent) write(csv);
      else remove();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [csv, delayMs]);

  /** Hides the restore offer without touching what is stored. */
  const dismiss = useCallback(() => setSavedDraft(null), []);
  /** Forgets the draft entirely, e.g. after a successful run or when the operator discards it. */
  const clear = useCallback(() => {
    remove();
    setSavedDraft(null);
  }, []);

  return { savedDraft, dismiss, clear };
}
