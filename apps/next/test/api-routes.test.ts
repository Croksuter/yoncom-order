import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("implemented Next API route handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("GET /api/menu returns menu categories from the DB query layer", async () => {
    const findMany = vi.fn(async () => [
      {
        id: "category_123456",
        name: "Meals",
        description: "Main dishes",
        menus: [],
      },
    ]);
    vi.doMock("~/lib/server/db", () => ({
      getDb: () => ({
        query: {
          menuCategories: {
            findMany,
          },
        },
      }),
    }));

    const { GET } = await import("~/app/api/menu/route");
    const response = await GET(new Request("http://order.test/api/menu"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: [
        {
          id: "category_123456",
          name: "Meals",
          description: "Main dishes",
          menus: [],
        },
      ],
    });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("GET /api/table validates the visible query string before DB access", async () => {
    const { GET } = await import("~/app/api/table/route");
    const response = await GET(new Request("http://order.test/api/table?tableId=too-short"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request" });
  });

  it("GET /api/admin/table returns the app-facing table relation payload", async () => {
    vi.doMock("~/lib/server/auth-session", () => ({
      requireAdmin: vi.fn(async () => null),
    }));
    vi.doMock("~/lib/server/table-queries", () => ({
      getTablesWithRelations: vi.fn(async () => [
        {
          id: "table_123456789",
          name: "A1",
          seats: 4,
          key: 1,
          createdAt: 1710000000000,
          updatedAt: 1710000000000,
          deletedAt: null,
          tableContexts: [],
        },
      ]),
    }));

    const { GET } = await import("~/app/api/admin/table/route");
    const response = await GET(new Request("http://order.test/api/admin/table"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: [
        {
          id: "table_123456789",
          name: "A1",
          seats: 4,
          key: 1,
          createdAt: 1710000000000,
          updatedAt: 1710000000000,
          deletedAt: null,
          tableContexts: [],
        },
      ],
    });
  });

  it("GET /api/order/[tableId] returns the migrated customer order DTO", async () => {
    const getCustomerOrderResponse = vi.fn(async () => ({
      tableId: "table_123456789",
      tableName: "A1",
      tableContextId: "ctx_12345678901",
      orders: [
        {
          id: "order_1234567",
          displayNumber: 3,
          status: "CANCELLED",
          createdAt: 1710000000001,
          expiresAt: null,
          cancelReason: "고객 요청",
          cancelledAt: 1710000000002,
          payment: {
            id: "payment_12345",
            status: "REFUND_PENDING",
            paid: true,
            originalAmount: 12000,
            expectedTransferAmount: 11999,
            paymentCode: 1,
            expiresAt: null,
            paidAt: 1710000000000,
            refundAmount: 11999,
            refundRequestedAt: 1710000000002,
            refundedAt: null,
          },
          menuOrders: [
            {
              id: "menuorder_123",
              menuId: "menu_1234567890",
              menuName: "비빔밥",
              price: 12000,
              quantity: 1,
              status: "CANCELLED",
            },
          ],
        },
      ],
    }));
    vi.doMock("~/lib/server/table-session", () => ({
      requireTableSession: vi.fn(async () => ({
        session: { tableContextId: "ctx_12345678901" },
        response: null,
      })),
    }));
    vi.doMock("~/lib/server/table-queries", () => ({ getCustomerOrderResponse }));

    const { GET } = await import("~/app/api/order/[tableId]/route");
    const response = await GET(new Request("http://order.test/api/order/table_123456789"), {
      params: Promise.resolve({ tableId: "table_123456789" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: expect.objectContaining({
        tableId: "table_123456789",
        tableContextId: "ctx_12345678901",
        orders: [
          expect.objectContaining({
            displayNumber: 3,
            cancelReason: "고객 요청",
            payment: expect.objectContaining({
              status: "REFUND_PENDING",
              refundAmount: 11999,
            }),
          }),
        ],
      }),
    });
    expect(getCustomerOrderResponse).toHaveBeenCalledWith("table_123456789");
  });

  it("GET /api/order/[tableId]/[orderId] rejects wrong table/order pairs as not found", async () => {
    const getCustomerOrderResponse = vi.fn(async () => ({
      tableId: "table_123456789",
      tableName: "A1",
      tableContextId: "ctx_12345678901",
      orders: [],
    }));
    vi.doMock("~/lib/server/table-session", () => ({
      requireTableSession: vi.fn(async () => ({
        session: { tableContextId: "ctx_12345678901" },
        response: null,
      })),
    }));
    vi.doMock("~/lib/server/table-queries", () => ({ getCustomerOrderResponse }));

    const { GET } = await import("~/app/api/order/[tableId]/[orderId]/route");
    const response = await GET(new Request("http://order.test/api/order/table_123456789/order_missing1"), {
      params: Promise.resolve({ tableId: "table_123456789", orderId: "order_missing1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Order Not Found" });
    expect(getCustomerOrderResponse).toHaveBeenCalledWith("table_123456789", "order_missing1");
  });

  it("all admin API route handlers are wired through requireAdmin", () => {
    const routeFiles: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const target = join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(target);
        } else if (entry.name === "route.ts") {
          routeFiles.push(target);
        }
      }
    };

    walk(join(process.cwd(), "app/api/admin"));

    expect(routeFiles.length).toBeGreaterThan(0);
    for (const routeFile of routeFiles) {
      const source = readFileSync(routeFile, "utf8");
      expect(source, routeFile).toContain("requireAdmin");
      expect(source, routeFile).toMatch(/await requireAdmin(?:User)?\(\)/);
    }
  });
});
