import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("admin dashboard layout", () => {
  beforeEach(() => {
    vi.useRealTimers();
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

  it("counts paid sales from closed table sessions in the header total", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T03:00:00.000Z"));
    const todayPaidAt = Date.parse("2026-05-28T02:00:00.000Z");
    const yesterdayPaidAt = Date.parse("2026-05-27T02:00:00.000Z");

    vi.doMock("next/navigation", () => ({
      usePathname: () => "/admin/pos",
      useRouter: () => ({ push: vi.fn() }),
    }));
    vi.doMock("~/stores/table.store", () => ({
      default: () => ({
        bankTransactions: [],
        tables: [
          {
            id: "table_closed",
            tableContexts: [
              {
                id: "ctx_closed",
                deletedAt: 1,
                orders: [
                  {
                    id: "order_closed_paid",
                    status: "ACTIVE",
                    deletedAt: null,
                    createdAt: todayPaidAt,
                    payment: { status: "PAID", originalAmount: 10000, amount: 9999, paidAt: todayPaidAt },
                    menuOrders: [{ menuId: "menu_1", quantity: 1 }],
                  },
                  {
                    id: "order_closed_yesterday_paid",
                    status: "ACTIVE",
                    deletedAt: null,
                    createdAt: yesterdayPaidAt,
                    payment: { status: "PAID", originalAmount: 99000, amount: 98999, paidAt: yesterdayPaidAt },
                    menuOrders: [{ menuId: "menu_1", quantity: 1 }],
                  },
                ],
              },
            ],
          },
          {
            id: "table_active",
            tableContexts: [
              {
                id: "ctx_active",
                deletedAt: null,
                orders: [
                  {
                    id: "order_active_paid",
                    status: "ACTIVE",
                    deletedAt: null,
                    createdAt: todayPaidAt,
                    payment: { status: "PAID", originalAmount: 5000, amount: 4999, paidAt: todayPaidAt },
                    menuOrders: [{ menuId: "menu_1", quantity: 1 }],
                  },
                  {
                    id: "order_pending",
                    status: "ACTIVE",
                    deletedAt: null,
                    createdAt: todayPaidAt,
                    payment: { status: "PENDING", originalAmount: 7000, amount: 7000, paidAt: todayPaidAt },
                    menuOrders: [{ menuId: "menu_1", quantity: 1 }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    }));
    vi.doMock("~/stores/menu.store", () => ({
      default: Object.assign(
        () => ({ menus: [{ id: "menu_1", price: 3000 }] }),
        { getState: () => ({ menus: [{ id: "menu_1", price: 3000 }] }) },
      ),
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

    expect(html).toContain("₩15,000");
  });
});
