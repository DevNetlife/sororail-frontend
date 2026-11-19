import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";

import { Nav } from "@/components/Nav";
import { NetworkGuard } from "@/components/NetworkGuard";
import { SessionActivityPanel } from "@/components/SessionActivityPanel";
import { ToastProvider } from "@/components/ToastProvider";
import { RpcProvider } from "@/lib/rpc-provider";
import { WalletProvider } from "@/lib/wallet";

import "./globals.css";

const DESCRIPTION =
  "Reference application for the SoroRail Soroban payment contracts. Testnet only, unaudited.";

export const metadata: Metadata = {
  title: { default: "SoroRail — reference app", template: "%s · SoroRail" },
  description: DESCRIPTION,
  openGraph: { title: "SoroRail — reference app", description: DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image", title: "SoroRail — reference app", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <ToastProvider>
        <RpcProvider>
        <WalletProvider>
          <NetworkGuard>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          {/*
           * The testnet warning is a permanent fixture, not a dismissible
           * toast. The contracts are unaudited, and the one thing this app
           * must never do is let someone believe they are moving real money.
           */}
          <div className="banner">
            <strong>Testnet only.</strong> These contracts are unaudited. Do not
            use them with real value.
          </div>
          <Nav />
          <main id="main-content" className="shell">{children}</main>
          <SessionActivityPanel />
          </NetworkGuard>
        </WalletProvider>
        </RpcProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
