import { useContext } from "react";

import { ToastContext, type ToastApi } from "@/components/ToastProvider";

/**
 * Access to the toast queue. Must be called under `<ToastProvider>`, which the
 * root layout mounts for every page.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>.");
  return api;
}
