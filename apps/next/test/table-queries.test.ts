import { describe, expect, it } from "vitest";
import { d1Success, installD1FetchMock, stubCloudflareEnv } from "./helpers/d1";

describe("table relation query network simulation", () => {
  it("reads legacy D1 tableContext and returns the app-facing tableContexts relation shape", async () => {
    stubCloudflareEnv();
    const { requests } = installD1FetchMock(({ sql, params }) => {
      if (sql.includes("sqlite_master") && params[0] === "tableContexts") {
        return d1Success([]);
      }
      if (sql.includes("sqlite_master") && params[0] === "tableContext") {
        return d1Success([{ name: "tableContext" }]);
      }
      if (sql === "SELECT * FROM tables") {
        return d1Success([
          {
            id: "table_123456789",
            key: 1,
            name: "A1",
            seats: 4,
            isTakeout: 0,
            takeoutFirstOrderRuleEnabled: 1,
            createdAt: 1710000000000,
            updatedAt: 1710000000000,
            deletedAt: null,
          },
        ]);
      }
      if (sql === "SELECT * FROM tableContext") {
        return d1Success([
          {
            id: "ctx_12345678901",
            tableId: "table_123456789",
            createdAt: "2026-05-18 09:00:00",
            updatedAt: "2026-05-18 09:00:00",
            deletedAt: null,
          },
        ]);
      }
      if (sql === "SELECT * FROM orders") {
        return d1Success([
          {
            id: "order_1234567",
            tableContextId: "ctx_12345678901",
            createdAt: 1710000000001,
            updatedAt: 1710000000001,
            deletedAt: null,
          },
        ]);
      }
      if (sql === "SELECT * FROM payments") {
        return d1Success([
          {
            id: "payment_12345",
            paid: 1,
            amount: 12000,
            bank: "Test Bank",
            depositor: "Tester",
            orderId: "order_1234567",
            createdAt: 1710000000002,
            updatedAt: 1710000000002,
            deletedAt: null,
          },
        ]);
      }
      if (sql === "SELECT * FROM menuOrders") {
        return d1Success([
          {
            id: "menuorder_123",
            quantity: 2,
            readyQuantity: 0,
            pickedUpQuantity: 0,
            status: "PENDING",
            orderId: "order_1234567",
            menuId: "menu_1234567890",
            createdAt: 1710000000003,
            updatedAt: 1710000000003,
            deletedAt: null,
          },
        ]);
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    });

    const { getTablesWithRelations } = await import("~/lib/server/table-queries");
    const tables = await getTablesWithRelations();

    expect(tables).toEqual([
      {
        id: "table_123456789",
        key: 1,
        name: "A1",
        seats: 4,
        isTakeout: false,
        takeoutFirstOrderRuleEnabled: true,
        createdAt: 1710000000000,
        updatedAt: 1710000000000,
        deletedAt: null,
        tableContexts: [
          {
            id: "ctx_12345678901",
            tableId: "table_123456789",
            createdAt: Date.parse("2026-05-18 09:00:00"),
            updatedAt: Date.parse("2026-05-18 09:00:00"),
            deletedAt: null,
            orders: [
              {
                id: "order_1234567",
                tableContextId: "ctx_12345678901",
                createdAt: 1710000000001,
                updatedAt: 1710000000001,
                deletedAt: null,
                payment: {
                  id: "payment_12345",
                  paid: true,
                  amount: 12000,
                  bank: "Test Bank",
                  depositor: "Tester",
                  orderId: "order_1234567",
                  status: "PAID",
                  originalAmount: 12000,
                  expectedTransferAmount: 12000,
                  expiresAt: null,
                  paidAt: null,
                  refundRequestedAt: null,
                  refundedAt: null,
                  createdAt: 1710000000002,
                  updatedAt: 1710000000002,
                  deletedAt: null,
                },
                menuOrders: [
                  {
                    id: "menuorder_123",
                    quantity: 2,
                    readyQuantity: 0,
                    pickedUpQuantity: 0,
                    status: "PENDING",
                    orderId: "order_1234567",
                    menuId: "menu_1234567890",
                    createdAt: 1710000000003,
                    updatedAt: 1710000000003,
                    deletedAt: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    expect(requests.map((request) => request.sql)).toEqual([
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      "SELECT * FROM tables",
      "SELECT * FROM tableContext",
      "SELECT * FROM orders",
      "SELECT * FROM payments",
      "SELECT * FROM menuOrders",
    ]);
  });
});
