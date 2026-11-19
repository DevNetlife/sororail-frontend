import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Payroll" };

export default function PayrollLayout({ children }: { children: ReactNode }) {
  return children;
}
