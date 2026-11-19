import type { ReactNode } from "react";

import { CopyButton } from "@/components/CopyButton";
import { explorerContract } from "@/lib/network";

/**
 * A contract address that links to the block explorer when the configured
 * network has one, and renders as plain text when it does not.
 *
 * Always renders a {@link CopyButton} so the full id is one click away.
 */
export function ContractLink({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const href = explorerContract(id);
  return (
    <span className="addr-wrap">
      {href ? (
        <a className={className} href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ) : (
        <span className={className}>{children}</span>
      )}
      <CopyButton text={id} label="Copy contract address" />
    </span>
  );
}
