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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <GlobalLoading />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
