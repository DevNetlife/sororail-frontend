"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { describeNetworkFee, type NetworkFeeState } from "@/lib/network-fee";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Confirmation before consequence.
 *
 * Every state-changing action in this app goes through here. The dialog shows
 * exactly what will happen — amounts, recipients, and what cannot be undone —
 * *before* the wallet prompt appears, because a signing prompt on its own tells
 * the user nothing about what they are agreeing to.
 *
 * The `irreversible` note is required rather than optional. If an action has no
 * irreversible consequence worth stating, it probably does not need a
 * confirmation dialog at all.
 */

export interface ConfirmLine {
  label: string;
  value: ReactNode;
}

export function Confirm({
  title,
  lines,
  irreversible,
  confirmLabel,
  fee,
  danger = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  title: string;
  /** What will happen, itemised. Amounts, recipients, fees. */
  lines: ConfirmLine[];
  /** What cannot be undone, in plain words. */
  irreversible: string;
  confirmLabel: string;
  /**
   * The estimated network fee (#399). When given, a fee line is always shown,
   * so it reads "Estimating…" first and never shifts the layout on load.
   */
  fee?: NetworkFeeState;
  danger?: boolean;
  busy?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const previousActiveElement =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    return () => {
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
          focusable[0]?.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [mounted]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!busy) onCancel();
        return;
      }

      if (event.key === "Tab") {
        if (!modalRef.current) return;
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusable[0]!;
        const lastElement = focusable[focusable.length - 1]!;

        if (event.shiftKey) {
          if (
            document.activeElement === firstElement ||
            !modalRef.current.contains(document.activeElement)
          ) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (
            document.activeElement === lastElement ||
            !modalRef.current.contains(document.activeElement)
          ) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  if (!mounted) return null;

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className="modal stack stack--tight">
        <h2>{title}</h2>

        <div className="modal__consequence">
          {lines.map((line, index) => (
            <div className="modal__line" key={index}>
              <span className="muted">{line.label}</span>
              <span>{line.value}</span>
            </div>
          ))}
          {fee ? (
            <div className="modal__line" data-testid="confirm-network-fee">
              <span className="muted">Estimated network fee</span>
              <span aria-live="polite">{describeNetworkFee(fee)}</span>
            </div>
          ) : null}
        </div>

        <div className="notice notice--warn">
          <div className="notice__title">This cannot be undone</div>
          <div className="notice__detail">{irreversible}</div>
        </div>

        <p className="small muted m-0">
          Your wallet will ask you to sign after you confirm. Nothing is sent
          until you do.
        </p>

        {error ? <div className="notice notice--error">{error}</div> : null}

        <div className="row row--end">
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? "button--danger" : "button--primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Waiting for wallet…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
