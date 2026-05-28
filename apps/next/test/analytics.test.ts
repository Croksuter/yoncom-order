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
});
