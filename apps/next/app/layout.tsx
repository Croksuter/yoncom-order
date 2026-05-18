import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yoncom Order",
  description: "Yoncom Order Next.js migration workspace",
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/auth", label: "Auth" },
  { href: "/client/table/demo-table", label: "Client Table" },
  { href: "/admin/pos", label: "POS" },
  { href: "/admin/cooker", label: "Cooker" },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">
              <strong>Yoncom Order</strong>
              <span>Next.js migration</span>
            </Link>
            <nav className="nav" aria-label="Primary">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
