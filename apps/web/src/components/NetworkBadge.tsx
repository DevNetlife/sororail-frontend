"use client";

import { NETWORK_GUARD_HELP } from "@/components/NetworkGuard";
import { NETWORK_PASSPHRASE } from "@/lib/network";
import { networkName } from "@/lib/network-name";

/**
 * Shows which network the app is configured for (#429). Testnet is the only supported network; anything else is shown
 * as a warning and carries the same help text NetworkGuard shows when it blocks the app.
 */
export function NetworkBadge({ passphrase = NETWORK_PASSPHRASE }: { passphrase?: string }) {
  const name = networkName(passphrase);
  const supported = name === "Testnet";
  const label = name ?? "Unknown network";
  return (
    <span
      className={supported ? "pill" : "pill pill--warn"}
      title={supported ? passphrase : NETWORK_GUARD_HELP}
      aria-label={supported ? `Network: ${label}` : `Network: ${label}. ${NETWORK_GUARD_HELP}`}
      data-testid="network-badge"
    >
      {label}
    </span>
  );
}
