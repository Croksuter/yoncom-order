import { beforeEach, describe, expect, it, vi } from "vitest";
import { d1Success, installD1FetchMock, stubCloudflareEnv } from "./helpers/d1";

function tableInfo(columns: string[]) {
  return d1Success(columns.map((name) => ({ name })));
}

describe("implemented mutation route handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    stubCloudflareEnv();
  });

  it("POST /api/order creates an order, decrements stock, and creates a payment in D1", async () => {
    const { requests } = installD1FetchMock(({ sql, params }) => {
      if (sql.includes("sqlite_master") && params[0] === "tableContexts") {
        return d1Success([{ name: "tableContexts" }]);
      }
      if (sql === "SELECT * FROM tables WHERE id = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([
          {
            id: "table_e2e_00001",
            key: 7,
            name: "E2E Table",
            seats: 2,
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
          },
        ]);
      }
      if (sql === "SELECT * FROM \"tableContexts\" WHERE tableId = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([]);
      }
      if (sql === "PRAGMA table_info(\"tableContexts\")") {
        return tableInfo(["id", "tableId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql.startsWith("INSERT INTO \"tableContexts\"")) {
        return d1Success([]);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(["id", "paid", "amount", "bank", "depositor", "orderId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql.includes("LEFT JOIN payments")) {
        return d1Success([]);
      }
      if (sql.startsWith("SELECT * FROM menus WHERE id IN")) {
        return d1Success([
          {
            id: "menu_e2e_000001",
            name: "Test Menu",
            price: 12000,
            quantity: 5,
            available: 1,
            menuCategoryId: "cat_e2e_000000",
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
          },
        ]);
      }
      if (sql === "UPDATE menus SET quantity = quantity - ?, updatedAt = ? WHERE id = ?") {
        return d1Success([]);
      }
      if (sql === "PRAGMA table_info(\"orders\")") {
        return tableInfo(["id", "tableContextId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql.startsWith("INSERT INTO \"orders\"")) {
        return d1Success([]);
      }
      if (sql === "PRAGMA table_info(\"menuOrders\")") {
        return tableInfo(["id", "quantity", "status", "orderId", "menuId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql.startsWith("INSERT INTO \"menuOrders\"")) {
        return d1Success([]);
      }
      if (sql.startsWith("INSERT INTO \"payments\"")) {
        return d1Success([]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { POST } = await import("~/app/api/order/route");
    const response = await POST(new Request("http://order.test/api/order", {
      method: "POST",
      body: JSON.stringify({
        tableId: "table_e2e_00001",
        menuOrders: [{ menuId: "menu_e2e_000001", quantity: 2 }],
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: "Order Created" });
    expect(requests.some((request) => request.sql === "UPDATE menus SET quantity = quantity - ?, updatedAt = ? WHERE id = ?")).toBe(true);
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"orders\""))).toBe(true);
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"menuOrders\""))).toBe(true);
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"payments\"") && request.params.includes(23993))).toBe(true);
  });

  it("POST /api/admin/deposit marks the newest matching unpaid payment as paid", async () => {
    const { requests } = installD1FetchMock(({ sql }) => {
      if (sql === "SELECT * FROM payments WHERE amount = ? AND paid = 0 AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 1") {
        return d1Success([
          {
            id: "pay_e2e_000001",
            paid: 0,
            amount: 23993,
            orderId: "order_e2e_0001",
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
          },
        ]);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(["id", "paid", "amount", "bank", "depositor", "method", "orderId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql.startsWith("UPDATE \"payments\"")) {
        return d1Success([]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { POST } = await import("~/app/api/admin/deposit/route");
    const response = await POST(new Request("http://order.test/api/admin/deposit", {
      method: "POST",
      body: JSON.stringify({
        amount: 23993,
        bank: "테스트은행",
        timestamp: 1710000000000,
        name: "테스터",
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: "ok" });
    const update = requests.find((request) => request.sql.startsWith("UPDATE \"payments\""));
    expect(update?.params).toContain(1);
    expect(update?.params).toContain("테스트은행");
    expect(update?.params).toContain("테스터");
  });

  it("POST /api/admin/table includes legacy userId when the live tables schema requires it", async () => {
    const { requests } = installD1FetchMock(({ sql }) => {
      if (sql === "SELECT * FROM tables WHERE name = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([]);
      }
      if (sql === "SELECT key FROM tables WHERE deletedAt IS NULL") {
        return d1Success([{ key: 1 }]);
      }
      if (sql === "PRAGMA table_info(\"tables\")") {
        return tableInfo(["id", "key", "name", "seats", "userId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql === "PRAGMA table_info(\"users\")") {
        return tableInfo(["id", "role", "createdAt", "deletedAt"]);
      }
      if (sql.startsWith("SELECT id FROM users")) {
        return d1Success([{ id: "user_admin0000" }]);
      }
      if (sql.startsWith("INSERT INTO \"tables\"")) {
        return d1Success([]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { POST } = await import("~/app/api/admin/table/route");
    const response = await POST(new Request("http://order.test/api/admin/table", {
      method: "POST",
      body: JSON.stringify({
        tableOptions: { name: "E2E 신규 테이블", seats: 3 },
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: "Table created" });
    const insert = requests.find((request) => request.sql.startsWith("INSERT INTO \"tables\""));
    expect(insert?.sql).toContain("\"userId\"");
    expect(insert?.params).toContain("user_admin0000");
  });
});
