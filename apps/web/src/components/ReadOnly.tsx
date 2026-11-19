"use client";

import { useEffect, useState, type ReactNode } from "react";

import { FREIGHTER_INSTALL_URL, hasWalletExtension } from "@/lib/walletExtension";

/** Why actions are unavailable while browsing without a wallet (#446). */
export const READ_ONLY_REASON =
  "Read-only: connect a wallet to sign. Viewing a position never needs one.";

/**
 * A row of position actions. Without a wallet every action inside is
 * disabled at once (a disabled fieldset disables all its controls) and the
 * reason is shown, while the figures above stay visible.
 */
export function ActionRow({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {readOnly ? (
        <p className="small muted" role="note">
          {READ_ONLY_REASON}
        </p>
      ) : null}
      <fieldset
        className="row action-row"
        disabled={readOnly}
        title={readOnly ? READ_ONLY_REASON : undefined}
      >
        {children}
      </fieldset>
    </>
  );
}

/**
 * Shown instead of a generic connect failure when no wallet extension is
 * installed (#445). Checked after mount, so server and first client render
 * agree, and again on focus, which is when a just-installed extension shows up.
 */
export function WalletMissingNotice() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const check = () => setMissing(!hasWalletExtension());
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  if (!missing) return null;
  return (
    <div className="notice notice--warn" role="status">
      <div className="notice__title">No Stellar wallet found</div>
      <div>
        This browser has no wallet extension, so it cannot sign transactions.
        Install{" "}
        <a href={FREIGHTER_INSTALL_URL} target="_blank" rel="noreferrer noopener">
          Freighter
        </a>{" "}
        for Chrome, Brave, Edge or Firefox, then reload this page.
      </div>
      <div className="notice__detail">
        Until then the app works read-only: positions you track still load from
        the chain, and only the actions that need a signature are unavailable.
      </div>
    </div>
  );
}
