import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Streams" };

export default function StreamsLayout({ children }: { children: ReactNode }) {
  return children;
}
