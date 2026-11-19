"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/**
 * Transient success and error notices (#396).
 *
 * Use a toast for a confirmation that does not need to stay on the page, such
 * as "Saved". Failures that the person must act on (a failed transaction, a
 * form that cannot submit) stay inline in `ErrorNotice`, because a toast
 * disappears before it can be read twice.
 *
 * Messages are plain sentences. Never pass a raw contract error code here;
 * decode it through `ContractError` first.
 */

export type ToastVariant = "success" | "error";

export interface ToastOptions {
  /** Milliseconds before auto-dismiss. Defaults: 5 s for success, 8 s for error. */
  duration?: number;
}

export interface ToastApi {
  success: (message: string, options?: ToastOptions) => number;
  error: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

export const DEFAULT_TOAST_DURATION: Record<ToastVariant, number> = {
  success: 5000,
  error: 8000,
};

/** Older toasts are dropped first, so a burst of notices cannot cover the page. */
const MAX_TOASTS = 5;

export const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const add = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      lastId.current += 1;
      const id = lastId.current;
      const duration = options?.duration ?? DEFAULT_TOAST_DURATION[variant];
      setToasts((current) =>
        [...current, { id, variant, message, duration }].slice(-MAX_TOASTS),
      );
      return id;
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => add("success", message, options),
      error: (message, options) => add("error", message, options),
      dismiss,
    }),
    [add, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={regionStyle}>
        {toasts.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  // Hover and focus both pause the countdown, so a person reading or tabbing
  // to the close button is never cut off.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  // Time left on the countdown. It shrinks each time the timer is paused.
  const remaining = useRef(item.duration);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timeout = setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      clearTimeout(timeout);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, item.id, onDismiss]);

  const isError = item.variant === "error";

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocused(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onDismiss(item.id);
    }
  }

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={isError ? "notice notice--error" : "notice notice--info"}
      style={toastStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <div style={{ flex: 1 }}>{item.message}</div>
      <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(item.id)}>
        Dismiss
      </button>
    </div>
  );
}

const regionStyle = {
  position: "fixed",
  right: "1rem",
  bottom: "1rem",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  maxWidth: "min(24rem, calc(100vw - 2rem))",
} as const;

const toastStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.75rem",
  margin: 0,
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
} as const;
