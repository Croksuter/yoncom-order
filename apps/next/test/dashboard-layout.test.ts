import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("admin dashboard layout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renders the signed-in admin name in the POS sidebar profile", async () => {
    vi.doMock("next/navigation", () => ({
      usePathname: () => "/admin/pos",
      useRouter: () => ({ push: vi.fn() }),
    }));
    vi.doMock("~/stores/table.store", () => ({
      default: () => ({ tables: [], bankTransactions: [] }),
    }));
    vi.doMock("~/stores/menu.store", () => ({
      default: () => ({ menus: [] }),
    }));
    vi.doMock("~/hooks/use-theme", () => ({
      useTheme: () => ({
        theme: "light",
        toggleTheme: vi.fn(),
        isDark: false,
        mounted: true,
      }),
    }));
    vi.doMock("~/lib/query", () => ({
      api: { post: vi.fn() },
    }));

    const { default: DashboardLayout } = await import("~/app/admin/dashboard-layout");
    const html = renderToStaticMarkup(
      React.createElement(
        DashboardLayout,
        {
          user: {
            id: "demo_user_admin",
            name: "최호영",
            email: "demo.admin@yoncom.local",
            role: "ADMIN",
          },
        },
        React.createElement("div", null, "content"),
      ),
    );

    expect(html).toContain("최호영");
    expect(html).toContain("최호");
    expect(html).not.toContain("Baseball Fan");
  });
});
