import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kitchen | Yoncom Order",
};

export default function AdminCookerLayout({ children }: { children: ReactNode }) {
  return children;
}
