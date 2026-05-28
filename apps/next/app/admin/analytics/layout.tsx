import type { Metadata } from "next";

const shopName = "첨크크";

export const metadata: Metadata = {
  title: `Analytics | ${shopName}`,
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
