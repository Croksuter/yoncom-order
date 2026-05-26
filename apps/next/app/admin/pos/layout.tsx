import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "POS | 첨크크",
};

export default function AdminPosLayout({ children }: { children: ReactNode }) {
  return children;
}
