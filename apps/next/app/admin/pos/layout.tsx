import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "POS | Yoncom Order",
};

export default function AdminPosLayout({ children }: { children: ReactNode }) {
  return children;
}
