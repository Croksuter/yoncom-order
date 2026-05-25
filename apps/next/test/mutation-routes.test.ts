import { beforeEach, describe, expect, it, vi } from "vitest";
import { d1Success, installD1FetchMock, stubCloudflareEnv } from "./helpers/d1";

const paymentColumns = [
  "id",
  "paid",
  "amount",
  "bank",
  "depositor",
  "method",
  "orderId",
  "status",
  "paymentCode",
  "originalAmount",
  "expectedTransferAmount",
  "expiresAt",
  "paidAt",
  "matchedBankTransactionId",
  "matchedBy",
  "depositorHint",
  "refundAmount",
  "refundRequestedAt",
  "refundedAt",
  "refundHandledByUserId",
  "refundNote",
  "createdAt",
  "updatedAt",
  "deletedAt",
];

const orderColumns = [
  "id",
  "tableContextId",
  "clientOrderId",
  "displayNumber",
  "status",
  "expiresAt",
  "cancelReason",
  "cancelledAt",
  "cancelledByUserId",
  "createdAt",
  "updatedAt",
  "deletedAt",
];

function tableInfo(columns: string[]) {
  return d1Success(columns.map((name) => ({ name })));
}

const guardedHeaders = {
  origin: "http://order.test",
  "content-type": "application/json",
  cookie: "yoncom_csrf=csrf-token",
  "x-csrf-token": "csrf-token",
  "idempotency-key": "test-idempotency-key",
};

function guardedJsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: guardedHeaders,
    body: JSON.stringify(body),
  });
}

function handleRealtimeSql(sql: string) {
  if (sql.startsWith("INSERT INTO scopeRevisions")) {
    return d1Success([{ revision: 1 }], { duration: 1, changes: 1 });
  }
  if (sql.startsWith("INSERT INTO domainEvents")) {
    return d1Success([], { duration: 1, changes: 1 });
  }
  if (sql.startsWith("SELECT tc.tableId, mo.orderId")) {
    return d1Success([{ tableId: "table_e2e_00001", orderId: "ord_paid_000001" }]);
  }
  if (sql.startsWith("SELECT tc.tableId")) {
    return d1Success([{ tableId: "table_e2e_00001" }]);
  }
  return null;
}

describe("implemented mutation route handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("~/lib/server/auth-session", () => ({
      csrfCookieName: "yoncom_csrf",
      requireAdmin: vi.fn(async () => null),
      requireAdminUser: vi.fn(async () => ({ user: { id: "user_admin0000", role: "ADMIN" }, response: null })),
    }));
    vi.doMock("~/lib/server/table-session", () => ({
      getValidTableSession: vi.fn(async () => ({
        id: "session_123456789",
        tableId: "table_e2e_00001",
        tableContextId: "ctx_12345678901",
        csrfToken: "csrf-token",
        expiresAt: Date.now() + 1000,
        revokedAt: null,
      })),
      createTableSession: vi.fn(async () => ({
        tableId: "table_e2e_00001",
        tableContextId: "ctx_12345678901",
        expiresAt: Date.now() + 1000,
        sessionId: "session_123456789",
        csrfToken: "csrf-token",
      })),
      attachTableSessionCookies: vi.fn((response) => response),
      requireTableSession: vi.fn(async () => ({
        session: { tableContextId: "ctx_12345678901" },
        response: null,
      })),
      requireTableSessionForOrder: vi.fn(async () => ({
        session: { tableContextId: "ctx_12345678901" },
        response: null,
      })),
      revokeTableSessions: vi.fn(async () => undefined),
    }));
    stubCloudflareEnv();
  });

  it("POST /api/order creates an idempotent order, decrements stock conditionally, and issues the smallest payment code", async () => {
    const { requests } = installD1FetchMock(({ sql, params }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success(params[0] === "tableContexts" || params[0] === "paymentCodeLeases" ? [{ name: params[0] }] : []);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql === "PRAGMA table_info(\"orders\")") {
        return tableInfo(orderColumns);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql === "PRAGMA table_info(\"tableContexts\")") {
        return tableInfo(["id", "tableId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql === "PRAGMA table_info(\"menuOrders\")") {
        return tableInfo(["id", "quantity", "status", "orderId", "menuId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql.startsWith("SELECT * FROM payments WHERE deletedAt IS NULL AND paid = 0 AND expiresAt")) {
        return d1Success([]);
      }
      if (sql === "DELETE FROM paymentCodeLeases WHERE expiresAt <= ?") {
        return d1Success([], { duration: 1, changes: 0 });
      }
      if (sql === "SELECT * FROM orders WHERE clientOrderId = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([]);
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
      if (sql === "SELECT * FROM \"tableContexts\" WHERE id = ? AND tableId = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([{ id: "ctx_12345678901", tableId: "table_e2e_00001", createdAt: 1, updatedAt: 1, deletedAt: null }]);
      }
      if (sql.startsWith("INSERT INTO \"tableContexts\"")) {
        return d1Success([], { duration: 1, changes: 1 });
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
      if (sql === "SELECT * FROM payments WHERE deletedAt IS NULL AND paid = 0 AND COALESCE(status, ?) IN (?, ?)") {
        return d1Success([]);
      }
      if (sql === "INSERT OR IGNORE INTO paymentCodeLeases (code, paymentId, expiresAt, createdAt) VALUES (?, ?, ?, ?)") {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "UPDATE menus SET quantity = quantity - ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL AND available = 1 AND quantity >= ?") {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "SELECT COALESCE(MAX(displayNumber), 0) + 1 AS nextDisplayNumber FROM orders") {
        return d1Success([{ nextDisplayNumber: 1 }]);
      }
      if (sql.startsWith("INSERT INTO \"orders\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("INSERT INTO \"menuOrders\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("INSERT INTO \"payments\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { POST } = await import("~/app/api/order/route");
    const response = await POST(guardedJsonRequest(
      "http://order.test/api/order",
      "POST",
      {
        tableId: "table_e2e_00001",
        clientOrderId: "client-order-001",
        menuOrders: [{ menuId: "menu_e2e_000001", quantity: 2 }],
      },
    ));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result).toEqual(expect.objectContaining({
      displayNumber: 1,
      payment: expect.objectContaining({
        status: "PENDING",
        originalAmount: 24000,
        paymentCode: 1,
        expectedTransferAmount: 23999,
      }),
    }));
    expect(requests.some((request) => request.sql === "UPDATE menus SET quantity = quantity - ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL AND available = 1 AND quantity >= ?")).toBe(true);
    const paymentInsert = requests.find((request) => request.sql.startsWith("INSERT INTO \"payments\""));
    expect(paymentInsert?.params).toContain(23999);
    expect(paymentInsert?.params).toContain(24000);
    expect(paymentInsert?.params).toContain(1);
  });

  it("POST /api/order starts a new table session for the first inactive-table order", async () => {
    vi.resetModules();
    vi.doMock("~/lib/server/auth-session", () => ({
      csrfCookieName: "yoncom_csrf",
      requireAdmin: vi.fn(async () => null),
      requireAdminUser: vi.fn(async () => ({ user: { id: "user_admin0000", role: "ADMIN" }, response: null })),
    }));
    vi.doUnmock("~/lib/server/table-session");
    stubCloudflareEnv();

    const { requests } = installD1FetchMock(({ sql, params }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success(params[0] === "tableContexts" || params[0] === "paymentCodeLeases" ? [{ name: params[0] }] : []);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql === "PRAGMA table_info(\"orders\")") {
        return tableInfo(orderColumns);
      }
      if (sql === "PRAGMA table_info(\"tableContexts\")") {
        return tableInfo(["id", "tableId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql === "PRAGMA table_info(\"menuOrders\")") {
        return tableInfo(["id", "quantity", "status", "orderId", "menuId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql.startsWith("SELECT * FROM payments WHERE deletedAt IS NULL AND paid = 0 AND expiresAt")) {
        return d1Success([]);
      }
      if (sql === "DELETE FROM paymentCodeLeases WHERE expiresAt <= ?") {
        return d1Success([], { duration: 1, changes: 0 });
      }
      if (sql === "SELECT * FROM orders WHERE clientOrderId = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([]);
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
      if (sql === "SELECT * FROM payments WHERE deletedAt IS NULL AND paid = 0 AND COALESCE(status, ?) IN (?, ?)") {
        return d1Success([]);
      }
      if (sql === "INSERT OR IGNORE INTO paymentCodeLeases (code, paymentId, expiresAt, createdAt) VALUES (?, ?, ?, ?)") {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "UPDATE menus SET quantity = quantity - ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL AND available = 1 AND quantity >= ?") {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("INSERT INTO \"tableContexts\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "SELECT COALESCE(MAX(displayNumber), 0) + 1 AS nextDisplayNumber FROM orders") {
        return d1Success([{ nextDisplayNumber: 1 }]);
      }
      if (sql.startsWith("INSERT INTO \"orders\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("INSERT INTO \"menuOrders\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("INSERT INTO \"payments\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("INSERT INTO tableSessions")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { POST } = await import("~/app/api/order/route");
    const response = await POST(guardedJsonRequest(
      "http://order.test/api/order",
      "POST",
      {
        tableId: "table_e2e_00001",
        clientOrderId: "client-order-self-start",
        menuOrders: [{ menuId: "menu_e2e_000001", quantity: 2 }],
        startNewTableSession: true,
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      result: expect.objectContaining({ displayNumber: 1 }),
    }));
    expect(response.headers.get("set-cookie")).toContain("yoncom_table_session=");
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"tableContexts\""))).toBe(true);
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO tableSessions"))).toBe(true);
  });

  it("POST /api/order rejects self-start when the table is already active without this client session", async () => {
    vi.resetModules();
    vi.doMock("~/lib/server/auth-session", () => ({
      csrfCookieName: "yoncom_csrf",
      requireAdmin: vi.fn(async () => null),
      requireAdminUser: vi.fn(async () => ({ user: { id: "user_admin0000", role: "ADMIN" }, response: null })),
    }));
    vi.doUnmock("~/lib/server/table-session");
    stubCloudflareEnv();

    const { requests } = installD1FetchMock(({ sql, params }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success(params[0] === "tableContexts" ? [{ name: params[0] }] : []);
      }
      if (sql === "PRAGMA table_info(\"orders\")") {
        return tableInfo(orderColumns);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql.startsWith("SELECT * FROM payments WHERE deletedAt IS NULL AND paid = 0 AND expiresAt")) {
        return d1Success([]);
      }
      if (sql === "SELECT * FROM orders WHERE clientOrderId = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([]);
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
        return d1Success([{ id: "ctx_existing000", tableId: "table_e2e_00001", createdAt: 1, updatedAt: 1, deletedAt: null }]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { POST } = await import("~/app/api/order/route");
    const response = await POST(guardedJsonRequest(
      "http://order.test/api/order",
      "POST",
      {
        tableId: "table_e2e_00001",
        clientOrderId: "client-order-blocked",
        menuOrders: [{ menuId: "menu_e2e_000001", quantity: 1 }],
        startNewTableSession: true,
      },
    ));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Table already in use" });
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"orders\""))).toBe(false);
  });

  it("POST /api/admin/deposit stores a bank transaction and auto-matches only a single exact expected amount", async () => {
    const { requests } = installD1FetchMock(({ sql, params }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success(params[0] === "tableContexts" || params[0] === "paymentCodeLeases" ? [{ name: params[0] }] : []);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql === "PRAGMA table_info(\"bankTransactions\")") {
        return tableInfo(["id", "dedupeKey", "amount", "depositor", "receivedAt", "rawText", "source", "status", "matchedPaymentId", "createdAt"]);
      }
      if (sql.startsWith("SELECT p.*, o.id AS orderId")) {
        return d1Success([
          {
            id: "pay_e2e_000001",
            paid: 0,
            amount: 23999,
            status: "PENDING",
            paymentCode: 1,
            originalAmount: 24000,
            expectedTransferAmount: 23999,
            orderId: "order_e2e_0001",
            tableName: "E2E Table",
            displayNumber: 1,
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
          },
        ]);
      }
      if (sql === "SELECT * FROM bankTransactions WHERE dedupeKey = ? LIMIT 1") {
        return d1Success([]);
      }
      if (sql.startsWith("INSERT INTO \"bankTransactions\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("UPDATE \"payments\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "DELETE FROM paymentCodeLeases WHERE paymentId = ?") {
        return d1Success([], { duration: 1, changes: 1 });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { POST } = await import("~/app/api/admin/deposit/route");
    const response = await POST(guardedJsonRequest(
      "http://order.test/api/admin/deposit",
      "POST",
      {
        amount: 23999,
        bank: "테스트은행",
        timestamp: 1710000000000,
        name: "테스터",
        source: "MANUAL",
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      result: {
        bankTransactionId: expect.any(String),
        status: "AUTO_MATCHED",
        matchedPaymentId: "pay_e2e_000001",
        candidateCount: 1,
      },
    }));
    const update = requests.find((request) => request.sql.startsWith("UPDATE \"payments\""));
    expect(update?.params).toContain(1);
    expect(update?.params).toContain("PAID");
    expect(update?.params).toContain("테스트은행");
    expect(update?.params).toContain("테스터");
  });

  it("POST /api/admin/table includes legacy userId when the live tables schema requires it", async () => {
    const { requests } = installD1FetchMock(({ sql }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
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
        return d1Success([], { duration: 1, changes: 1 });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { POST } = await import("~/app/api/admin/table/route");
    const response = await POST(guardedJsonRequest(
      "http://order.test/api/admin/table",
      "POST",
      {
        tableOptions: { name: "E2E 신규 테이블", seats: 3 },
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ result: "Table created" }));
    const insert = requests.find((request) => request.sql.startsWith("INSERT INTO \"tables\""));
    expect(insert?.sql).toContain("\"userId\"");
    expect(insert?.params).toContain("user_admin0000");
  });

  it("admin mutation routes reject requests when requireAdmin fails", async () => {
    vi.resetModules();
    vi.doMock("~/lib/server/auth-session", () => ({
      csrfCookieName: "yoncom_csrf",
      requireAdmin: vi.fn(async () => Response.json({ error: "Forbidden" }, { status: 403 })),
    }));
    stubCloudflareEnv();
    const { POST } = await import("~/app/api/admin/deposit/route");

    const response = await POST(guardedJsonRequest(
      "http://order.test/api/admin/deposit",
      "POST",
      {
        amount: 23999,
        bank: "테스트은행",
        timestamp: 1710000000000,
        name: "테스터",
        source: "MANUAL",
      },
    ));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("DELETE /api/admin/order keeps a paid cancelled order visible and marks its payment refund pending", async () => {
    const { requests } = installD1FetchMock(({ sql }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success([{ name: "paymentCodeLeases" }]);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql === "PRAGMA table_info(\"menuOrders\")") {
        return tableInfo(["id", "quantity", "status", "orderId", "menuId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql === "PRAGMA table_info(\"orders\")") {
        return tableInfo(orderColumns);
      }
      if (sql === "SELECT * FROM orders WHERE id = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([{
          id: "ord_paid_000001",
          tableContextId: "ctx_12345678901",
          displayNumber: 7,
          status: "ACTIVE",
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }]);
      }
      if (sql === "SELECT * FROM payments WHERE orderId = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([{
          id: "pay_paid_000001",
          paid: 1,
          amount: 11999,
          orderId: "ord_paid_000001",
          status: "PAID",
          originalAmount: 12000,
          expectedTransferAmount: 11999,
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }]);
      }
      if (sql === "SELECT * FROM menuOrders WHERE orderId = ? AND deletedAt IS NULL") {
        return d1Success([{
          id: "menuorder_12345",
          quantity: 1,
          status: "PENDING",
          orderId: "ord_paid_000001",
          menuId: "menu_1234567890",
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }]);
      }
      if (sql === "UPDATE menus SET quantity = quantity + ?, updatedAt = ? WHERE id = ?") {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("UPDATE \"menuOrders\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("UPDATE \"payments\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("UPDATE \"orders\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "DELETE FROM paymentCodeLeases WHERE paymentId = ?") {
        return d1Success([], { duration: 1, changes: 1 });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { DELETE } = await import("~/app/api/admin/order/route");
    const response = await DELETE(guardedJsonRequest(
      "http://order.test/api/admin/order",
      "DELETE",
      { orderId: "ord_paid_000001", cancelReason: "고객 요청" },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ result: "Order cancelled; refund pending" }));
    const paymentUpdate = requests.find((request) => request.sql.startsWith("UPDATE \"payments\""));
    expect(paymentUpdate?.sql).not.toContain("\"deletedAt\"");
    expect(paymentUpdate?.params).toContain("REFUND_PENDING");
    expect(paymentUpdate?.params).toContain(11999);
    const orderUpdate = requests.find((request) => request.sql.startsWith("UPDATE \"orders\""));
    expect(orderUpdate?.sql).not.toContain("\"deletedAt\"");
    expect(orderUpdate?.params).toContain("고객 요청");
    expect(orderUpdate?.params).toContain("user_admin0000");
  });

  it("PUT /api/admin/order/refund only completes refund pending payments", async () => {
    const { requests } = installD1FetchMock(({ sql }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql === "SELECT * FROM orders WHERE id = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([{
          id: "ord_refund_0001",
          tableContextId: "ctx_12345678901",
          status: "CANCELLED",
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }]);
      }
      if (sql === "SELECT * FROM payments WHERE orderId = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([{
          id: "pay_refund0001",
          paid: 1,
          amount: 11999,
          orderId: "ord_refund_0001",
          status: "REFUND_PENDING",
          refundAmount: 11999,
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }]);
      }
      if (sql.startsWith("UPDATE \"payments\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { PUT } = await import("~/app/api/admin/order/refund/route");
    const response = await PUT(guardedJsonRequest(
      "http://order.test/api/admin/order/refund",
      "PUT",
      { orderId: "ord_refund_0001", refundNote: "계좌 환불 완료" },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ result: "Order refund completed" }));
    const paymentUpdate = requests.find((request) => request.sql.startsWith("UPDATE \"payments\""));
    expect(paymentUpdate?.params).toContain(0);
    expect(paymentUpdate?.params).toContain("REFUNDED");
    expect(paymentUpdate?.params).toContain("user_admin0000");
    expect(paymentUpdate?.params).toContain("계좌 환불 완료");
  });
});
