import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Vesting" };

export default function VestingLayout({ children }: { children: ReactNode }) {
  return children;
}
