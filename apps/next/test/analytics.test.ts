import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildAdminAnalytics,
  getAppliedUnitCost,
  getRecommendedPrice,
  type AnalyticsMenu,
  type AnalyticsMenuBundleItem,
} from "~/lib/analytics";

function menu(overrides: Partial<AnalyticsMenu> = {}): AnalyticsMenu {
  return {
    id: "menu_0000000001",
    name: "테스트 메뉴",
    price: 9000,
    unitCost: null,
    targetMarginBps: 3500,
    quantity: 10,
    menuCategoryId: "cat_00000000001",
    deletedAt: null,
    ...overrides,
  };
}

describe("admin analytics calculations", () => {
  it("uses price/3 as the applied unit cost when unitCost is empty", () => {
    const target = menu({ price: 9900, unitCost: null });
    expect(getAppliedUnitCost(target, new Map([[target.id, target]]), new Map())).toBe(3300);
  });

  it("prefers explicit bundle cost, then component costs, then bundle price fallback", () => {
    const component = menu({ id: "menu_component1", price: 3000, unitCost: 900 });
    const bundle = menu({ id: "menu_bundle001", price: 10000, unitCost: null });
    const explicitBundle = menu({ id: "menu_bundle002", price: 10000, unitCost: 2500 });
    const noComponentCost = menu({ id: "menu_bundle003", price: 12000, unitCost: null });
    const menusById = new Map([component, bundle, explicitBundle, noComponentCost].map((row) => [row.id, row]));
    const bundleItems: AnalyticsMenuBundleItem[] = [
      { bundleMenuId: bundle.id, componentMenuId: component.id, quantity: 2 },
      { bundleMenuId: explicitBundle.id, componentMenuId: component.id, quantity: 2 },
    ];
    const bundleItemsById = new Map<string, AnalyticsMenuBundleItem[]>([
      [bundle.id, [bundleItems[0]]],
      [explicitBundle.id, [bundleItems[1]]],
    ]);

    expect(getAppliedUnitCost(bundle, menusById, bundleItemsById)).toBe(1800);
    expect(getAppliedUnitCost(explicitBundle, menusById, bundleItemsById)).toBe(2500);
    expect(getAppliedUnitCost(noComponentCost, menusById, bundleItemsById)).toBe(4000);
  });

  it("rounds recommended prices up to the next 100 won", () => {
    expect(getRecommendedPrice(3300, 3500)).toBe(5100);
  });

  it("keeps recommended prices finite for invalid intermediate inputs", () => {
    expect(getRecommendedPrice(Number.NaN, 3500)).toBe(0);
    expect(getRecommendedPrice(3300, Number.NaN)).toBe(5100);
  });

  it("separates completed refunds from refund-pending liabilities", () => {
    const from = Date.parse("2026-05-28T00:00:00.000Z");
    const paidAt = from + 1000;
    const target = menu({ price: 9000, unitCost: null });
    const result = buildAdminAnalytics({
      from,
      to: from + 60_000,
      bucket: "hour",
      categories: [{ id: target.menuCategoryId, name: "메인" }],
      menus: [target],
      bundleItems: [],
      bankTransactions: [],
      tables: [
        {
          tableContexts: [
            {
              orders: [
                {
                  id: "order_paid",
                  status: "ACTIVE",
                  createdAt: paidAt,
                  deletedAt: null,
                  payment: { status: "PAID", amount: 9000, originalAmount: 9000, paidAt, deletedAt: null },
                  menuOrders: [{ menuId: target.id, quantity: 1, deletedAt: null }],
                },
                {
                  id: "order_refunded",
                  status: "CANCELLED",
                  createdAt: paidAt + 1,
                  deletedAt: null,
                  payment: { status: "REFUNDED", amount: 9000, originalAmount: 9000, refundAmount: 9000, paidAt, deletedAt: null },
                  menuOrders: [{ menuId: target.id, quantity: 1, deletedAt: null }],
                },
                {
                  id: "order_refund_pending",
                  status: "ACTIVE",
                  createdAt: paidAt + 2,
                  deletedAt: null,
                  payment: { status: "REFUND_PENDING", amount: 9000, originalAmount: 9000, refundAmount: 9000, paidAt, deletedAt: null },
                  menuOrders: [{ menuId: target.id, quantity: 1, deletedAt: null }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.summary.grossSales.value).toBe(27000);
    expect(result.summary.refundAmount.value).toBe(9000);
    expect(result.paymentFlow.refundPendingAmount).toBe(9000);
    expect(result.summary.estimatedCost.value).toBe(9000);
    expect(result.summary.estimatedProfit.value).toBe(9000);
  });

  it("adds category revenue share and order/payment record rows", () => {
    const from = Date.parse("2026-05-28T00:00:00.000Z");
    const paidAt = from + 1000;
    const main = menu({ id: "menu_main0001", menuCategoryId: "cat_main", price: 9000, unitCost: 3000 });
    const drink = menu({ id: "menu_drink001", menuCategoryId: "cat_drink", price: 3000, unitCost: 1000 });
    const result = buildAdminAnalytics({
      from,
      to: from + 60_000,
      bucket: "hour",
      categories: [
        { id: "cat_main", name: "메인" },
        { id: "cat_drink", name: "음료" },
      ],
      menus: [main, drink],
      bundleItems: [],
      bankTransactions: [],
      tables: [
        {
          id: "table_1",
          name: "A1",
          tableContexts: [
            {
              id: "ctx_1",
              orders: [
                {
                  id: "order_share",
                  displayNumber: 12,
                  status: "ACTIVE",
                  createdAt: paidAt,
                  deletedAt: null,
                  payment: {
                    id: "payment_share",
                    status: "PAID",
                    amount: 12000,
                    originalAmount: 12000,
                    paymentCode: 7,
                    paidAt,
                    deletedAt: null,
                  },
                  menuOrders: [
                    { menuId: main.id, quantity: 1, deletedAt: null },
                    { menuId: drink.id, quantity: 1, deletedAt: null },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.categoryRows).toEqual([
      expect.objectContaining({ categoryName: "메인", revenueShare: 0.75 }),
      expect.objectContaining({ categoryName: "음료", revenueShare: 0.25 }),
    ]);
    expect(result.recordRows[0]).toEqual(expect.objectContaining({
      orderId: "order_share",
      paymentId: "payment_share",
      tableName: "A1",
      displayNumber: 12,
      grossSales: 12000,
      estimatedCost: 4000,
      estimatedProfit: 8000,
      itemCount: 2,
      paymentCode: 7,
    }));
  });
});

describe("admin analytics route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("requires admin auth before serving analytics", async () => {
    vi.doMock("~/lib/server/auth-session", () => ({
      requireAdmin: vi.fn(async () => Response.json({ error: "Unauthorized" }, { status: 401 })),
    }));
    vi.doMock("~/lib/server/admin-analytics", () => ({
      getAdminAnalytics: vi.fn(),
    }));

    const { GET } = await import("~/app/api/admin/analytics/route");
    const response = await GET(new Request("http://order.test/api/admin/analytics?from=1&to=2&bucket=hour"));

    expect(response.status).toBe(401);
  });

  it("validates analytics ranges before data access", async () => {
    vi.doMock("~/lib/server/auth-session", () => ({
      requireAdmin: vi.fn(async () => null),
    }));
    const getAdminAnalytics = vi.fn();
    vi.doMock("~/lib/server/admin-analytics", () => ({ getAdminAnalytics }));

    const { GET } = await import("~/app/api/admin/analytics/route");
    const response = await GET(new Request("http://order.test/api/admin/analytics?from=2&to=1&bucket=day"));

    expect(response.status).toBe(400);
    expect(getAdminAnalytics).not.toHaveBeenCalled();
  });

  it("returns the analytics aggregation payload", async () => {
    vi.doMock("~/lib/server/auth-session", () => ({
      requireAdmin: vi.fn(async () => null),
    }));
    const payload = buildAdminAnalytics({
      from: 1,
      to: 2,
      bucket: "hour",
      tables: [],
      categories: [],
      menus: [],
      bundleItems: [],
      bankTransactions: [],
      generatedAt: 123,
    });
    vi.doMock("~/lib/server/admin-analytics", () => ({
      getAdminAnalytics: vi.fn(async () => payload),
    }));

    const { GET } = await import("~/app/api/admin/analytics/route");
    const response = await GET(new Request("http://order.test/api/admin/analytics?from=1&to=2&bucket=hour"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: payload });
  });

  it("deletes selected analytics records through a guarded mutation", async () => {
    vi.doMock("~/lib/server/auth-session", () => ({
      csrfCookieName: "yoncom_csrf",
      requireAdmin: vi.fn(async () => null),
    }));
    vi.doMock("~/lib/server/api", async (importOriginal) => {
      const actual = await importOriginal<typeof import("~/lib/server/api")>();
      return {
        ...actual,
        idempotentMutationResponse: vi.fn(async (_request: Request, _scope: string, _body: unknown, mutate: () => Promise<{ result?: unknown; status: number }>) => {
          const result = await mutate();
          return Response.json({ result: result.result }, { status: result.status });
        }),
      };
    });
    const deleteAdminAnalyticsRecords = vi.fn(async () => ({
      result: "Deleted 1 order records and 1 payment records",
      status: 200,
    }));
    vi.doMock("~/lib/server/admin-analytics", () => ({
      getAdminAnalytics: vi.fn(),
      deleteAdminAnalyticsRecords,
    }));

    const { DELETE } = await import("~/app/api/admin/analytics/route");
    const response = await DELETE(new Request("http://order.test/api/admin/analytics", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        origin: "http://order.test",
        cookie: "yoncom_csrf=csrf-token",
        "x-csrf-token": "csrf-token",
        "idempotency-key": "delete-analytics-records",
      },
      body: JSON.stringify({ orderIds: ["order_1"], paymentIds: ["payment_1"] }),
    }));

    expect(response.status).toBe(200);
    expect(deleteAdminAnalyticsRecords).toHaveBeenCalledWith({ orderIds: ["order_1"], paymentIds: ["payment_1"] });
  });
});
