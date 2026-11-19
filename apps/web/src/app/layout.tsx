import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";

import { Nav } from "@/components/Nav";
import { NetworkGuard } from "@/components/NetworkGuard";
import { SessionActivityPanel } from "@/components/SessionActivityPanel";
import { ToastProvider } from "@/components/ToastProvider";
import { RpcProvider } from "@/lib/rpc-provider";
import { WalletProvider } from "@/lib/wallet";

import "./globals.css";

export const metadata: Metadata = {
  title: "SoroRail — reference app",
  description:
    "Reference application for the SoroRail Soroban payment contracts. Testnet only, unaudited.",
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
