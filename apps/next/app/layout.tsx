import type { Metadata } from "next";
import { Toaster } from "~/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yoncom Order",
  description: "Yoncom Order festival booth POS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
