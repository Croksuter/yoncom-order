import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "고객 주문 | Yoncom Order",
};

export default function ClientTableLayout({ children }: { children: ReactNode }) {
  return children;
}
