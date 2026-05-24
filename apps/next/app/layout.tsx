import type { Metadata } from "next";
import { Toaster } from "~/components/ui/toaster";
import GlobalLoading from "~/components/global-loading";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yoncom Order",
  description: "Yoncom Order festival booth POS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <GlobalLoading />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
