import type { Metadata } from "next";
import { Toaster } from "~/components/ui/toaster";
import GlobalLoading from "~/components/global-loading";
import ThemeInitializer from "~/components/theme-initializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "첨크크",
  description: "첨크크 festival booth POS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeInitializer />
        <GlobalLoading />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
