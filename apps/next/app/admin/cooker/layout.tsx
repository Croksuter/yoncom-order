import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kitchen | 첨크크",
};

export default function AdminCookerLayout({ children }: { children: ReactNode }) {
  return children;
}
