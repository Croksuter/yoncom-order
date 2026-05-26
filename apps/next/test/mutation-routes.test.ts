import { beforeEach, describe, expect, it, vi } from "vitest";
import { d1Success, installD1FetchMock, stubCloudflareEnv, type D1Request } from "./helpers/d1";

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

function isTableContextBlockingOrderSql(sql: string) {
  return sql.startsWith("SELECT o.* FROM orders o LEFT JOIN payments p ON")
    && sql.includes("o.tableContextId = ?")
    && sql.includes("COALESCE(o.status")
    && sql.includes("p.paid = 1")
    && sql.includes("COALESCE(p.status");
}

function testMenu(overrides: Record<string, unknown> = {}) {
  return {
    id: "menu_e2e_000001",
    name: "Test Menu",
    nameEn: null,
    description: null,
    descriptionEn: null,
    price: 12000,
    quantity: 5,
    available: 1,
    menuCategoryId: "cat_e2e_000000",
    image: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...overrides,
  };
}

function testTableContext(overrides: Record<string, unknown> = {}) {
  return {
    id: "ctx_12345678901",
    tableId: "table_e2e_00001",
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...overrides,
  };
}

function installCreateOrderMutationMock(options: {
  menus: Array<Record<string, unknown>>;
  existingMode?: boolean;
  activeTableContext?: Record<string, unknown> | null;
  existingOrder?: Record<string, unknown> | null;
  existingPayment?: Record<string, unknown> | null;
  firstOrderRule?: Record<string, unknown> | null;
  firstOrderRuleMenuCounts?: Array<Record<string, unknown>>;
  bundleItems?: Array<Record<string, unknown>>;
  stockUpdateChanges?: Record<string, number>;
}) {
  return installD1FetchMock(({ sql, params }: D1Request) => {
    const realtime = handleRealtimeSql(sql);
    if (realtime) return realtime;
    if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
      const tableName = String(params[0]);
      const availableTables = new Set([
        "tableContexts",
        "paymentCodeLeases",
        ...(options.firstOrderRule !== undefined ? ["firstOrderRules"] : []),
        ...(options.firstOrderRuleMenuCounts ? ["firstOrderRuleMenuCounts"] : []),
        ...(options.bundleItems ? ["menuBundleItems"] : []),
      ]);
      return d1Success(availableTables.has(tableName) ? [{ name: tableName }] : []);
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
      return d1Success(options.existingOrder ? [options.existingOrder] : []);
    }
    if (sql === "SELECT * FROM payments WHERE orderId = ? AND deletedAt IS NULL LIMIT 1") {
      return d1Success(options.existingPayment ? [options.existingPayment] : []);
    }
    if (sql === "SELECT * FROM tables WHERE id = ? AND deletedAt IS NULL LIMIT 1") {
      return d1Success([{
        id: "table_e2e_00001",
        key: 7,
        name: "E2E Table",
        seats: 2,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
      }]);
    }
    if (sql === "SELECT * FROM \"tableContexts\" WHERE id = ? AND tableId = ? AND deletedAt IS NULL LIMIT 1") {
      return d1Success(options.activeTableContext ? [options.activeTableContext] : [testTableContext()]);
    }
    if (sql === "SELECT * FROM \"tableContexts\" WHERE tableId = ? AND deletedAt IS NULL LIMIT 1") {
      return d1Success(options.activeTableContext && !options.existingMode ? [options.activeTableContext] : []);
    }
    if (sql.includes("LEFT JOIN payments")) {
      return d1Success([]);
    }
    if (sql.startsWith("SELECT * FROM menus WHERE id IN")) {
      const ids = new Set(params.map(String));
      return d1Success(options.menus.filter((menu) => ids.has(String(menu.id))));
    }
    if (sql === "SELECT * FROM firstOrderRules WHERE id = ? LIMIT 1") {
      return d1Success(options.firstOrderRule ? [options.firstOrderRule] : []);
    }
    if (sql === "SELECT * FROM firstOrderRuleMenuCounts WHERE ruleId = ?") {
      return d1Success(options.firstOrderRuleMenuCounts ?? []);
    }
    if (sql.startsWith("SELECT mbi.*")) {
      return d1Success((options.bundleItems ?? []).map((item) => {
        const component = options.menus.find((menu) => menu.id === item.componentMenuId);
        return {
          ...item,
          componentName: component?.name ?? null,
          componentNameEn: component?.nameEn ?? null,
          componentQuantity: component?.quantity ?? null,
          componentAvailable: component?.available ?? null,
        };
      }));
    }
    if (sql === "SELECT * FROM payments WHERE deletedAt IS NULL AND paid = 0 AND COALESCE(status, ?) IN (?, ?)") {
      return d1Success([]);
    }
    if (sql === "INSERT OR IGNORE INTO paymentCodeLeases (code, paymentId, expiresAt, createdAt) VALUES (?, ?, ?, ?)") {
      return d1Success([], { duration: 1, changes: 1 });
    }
    if (sql === "UPDATE menus SET quantity = quantity - ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL AND available = 1 AND quantity >= ?") {
      return d1Success([], {
        duration: 1,
        changes: options.stockUpdateChanges?.[String(params[2])] ?? 1,
      });
    }
    if (sql === "UPDATE menus SET quantity = quantity + ?, updatedAt = ? WHERE id = ?") {
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
    if (sql === "DELETE FROM paymentCodeLeases WHERE paymentId = ?") {
      return d1Success([], { duration: 1, changes: 1 });
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
}

describe("implemented mutation route handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("~/lib/server/d1-mutations");
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

  it("first-order rule rejects an inactive-table first order before stock, payment, or table context writes", async () => {
    const { requests } = installCreateOrderMutationMock({
      menus: [testMenu({ id: "menu_rule_000001", menuCategoryId: "cat_other_00000", quantity: 5 })],
      firstOrderRule: {
        id: "default",
        enabled: 1,
        requiredCount: 2,
        createdAt: 1,
        updatedAt: 1,
      },
      firstOrderRuleMenuCounts: [{
        ruleId: "default",
        menuId: "menu_rule_000001",
        countAs: 0,
        createdAt: 1,
        updatedAt: 1,
      }],
    });

    const { createClientOrderForNewTableSession } = await import("~/lib/server/d1-mutations");
    const result = await createClientOrderForNewTableSession(
      "table_e2e_00001",
      "client-order-rule-reject",
      [{ menuId: "menu_rule_000001", quantity: 1 }],
    );

    expect(result).toEqual({ error: "First Order Rule Not Satisfied", status: 409 });
    expect(requests.some((request) => request.sql.startsWith("UPDATE menus SET quantity = quantity -"))).toBe(false);
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"tableContexts\""))).toBe(false);
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"orders\""))).toBe(false);
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"payments\""))).toBe(false);
  });

  it("first-order rule accepts countAs overrides on inactive-table first orders", async () => {
    const { requests } = installCreateOrderMutationMock({
      menus: [testMenu({ id: "menu_rule_000002", menuCategoryId: "cat_required00", quantity: 5, price: 7000 })],
      firstOrderRule: {
        id: "default",
        enabled: 1,
        requiredCount: 3,
        createdAt: 1,
        updatedAt: 1,
      },
      firstOrderRuleMenuCounts: [{
        ruleId: "default",
        menuId: "menu_rule_000002",
        countAs: 3,
        createdAt: 1,
        updatedAt: 1,
      }],
    });

    const { createClientOrderForNewTableSession } = await import("~/lib/server/d1-mutations");
    const result = await createClientOrderForNewTableSession(
      "table_e2e_00001",
      "client-order-rule-pass",
      [{ menuId: "menu_rule_000002", quantity: 1 }],
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.result).toEqual(expect.objectContaining({
      payment: expect.objectContaining({
        originalAmount: 7000,
      }),
    }));
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"tableContexts\""))).toBe(true);
    const stockUpdate = requests.find((request) => request.sql.startsWith("UPDATE menus SET quantity = quantity -"));
    expect(stockUpdate?.params[0]).toBe(1);
    expect(stockUpdate?.params[2]).toBe("menu_rule_000002");
  });

  it("first-order rule is bypassed for existing-session second orders", async () => {
    const { requests } = installCreateOrderMutationMock({
      existingMode: true,
      activeTableContext: testTableContext(),
      menus: [testMenu({ id: "menu_second_0001", menuCategoryId: "cat_other_00000", quantity: 5 })],
      firstOrderRule: {
        id: "default",
        enabled: 1,
        requiredCount: 99,
        createdAt: 1,
        updatedAt: 1,
      },
      firstOrderRuleMenuCounts: [],
    });

    const { createClientOrder } = await import("~/lib/server/d1-mutations");
    const result = await createClientOrder(
      "table_e2e_00001",
      "ctx_12345678901",
      "client-order-second",
      [{ menuId: "menu_second_0001", quantity: 1 }],
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(requests.some((request) => request.sql === "SELECT * FROM firstOrderRules WHERE id = ? LIMIT 1")).toBe(false);
  });

  it("bundle orders decrement component stock, charge the bundle price, and store one bundle menuOrder row", async () => {
    const { requests } = installCreateOrderMutationMock({
      existingMode: true,
      activeTableContext: testTableContext(),
      menus: [
        testMenu({ id: "menu_bundle_0001", name: "Bundle", price: 15000, quantity: 99, menuCategoryId: "cat_bundle0000" }),
        testMenu({ id: "menu_component01", name: "Component", price: 4000, quantity: 10, menuCategoryId: "cat_component0" }),
      ],
      bundleItems: [{
        bundleMenuId: "menu_bundle_0001",
        componentMenuId: "menu_component01",
        quantity: 2,
        createdAt: 1,
        updatedAt: 1,
      }],
    });

    const { createClientOrder } = await import("~/lib/server/d1-mutations");
    const result = await createClientOrder(
      "table_e2e_00001",
      "ctx_12345678901",
      "client-order-bundle",
      [{ menuId: "menu_bundle_0001", quantity: 2 }],
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.result).toEqual(expect.objectContaining({
      payment: expect.objectContaining({
        originalAmount: 30000,
      }),
    }));
    const stockUpdate = requests.find((request) => request.sql.startsWith("UPDATE menus SET quantity = quantity -"));
    expect(stockUpdate?.params[0]).toBe(4);
    expect(stockUpdate?.params[2]).toBe("menu_component01");
    const menuOrderInsert = requests.find((request) => request.sql.startsWith("INSERT INTO \"menuOrders\""));
    expect(menuOrderInsert?.params).toContain("menu_bundle_0001");
    expect(requests.filter((request) => request.sql.startsWith("INSERT INTO \"menuOrders\""))).toHaveLength(1);
  });

  it("bundle stock conflicts roll back prior component decrements and skip order writes", async () => {
    const { requests } = installCreateOrderMutationMock({
      existingMode: true,
      activeTableContext: testTableContext(),
      menus: [
        testMenu({ id: "menu_bundle_0002", name: "Bundle", price: 15000, quantity: 99, menuCategoryId: "cat_bundle0000" }),
        testMenu({ id: "menu_component02", name: "Component A", quantity: 10, menuCategoryId: "cat_component0" }),
        testMenu({ id: "menu_component03", name: "Component B", quantity: 10, menuCategoryId: "cat_component0" }),
      ],
      bundleItems: [
        { bundleMenuId: "menu_bundle_0002", componentMenuId: "menu_component02", quantity: 1, createdAt: 1, updatedAt: 1 },
        { bundleMenuId: "menu_bundle_0002", componentMenuId: "menu_component03", quantity: 1, createdAt: 1, updatedAt: 1 },
      ],
      stockUpdateChanges: {
        menu_component02: 1,
        menu_component03: 0,
      },
    });

    const { createClientOrder } = await import("~/lib/server/d1-mutations");
    const result = await createClientOrder(
      "table_e2e_00001",
      "ctx_12345678901",
      "client-order-bundle-conflict",
      [{ menuId: "menu_bundle_0002", quantity: 1 }],
    );

    expect(result).toEqual({ error: "Menu Not Enough", status: 409 });
    const restock = requests.find((request) => request.sql === "UPDATE menus SET quantity = quantity + ?, updatedAt = ? WHERE id = ?");
    expect(restock?.params[0]).toBe(1);
    expect(restock?.params[2]).toBe("menu_component02");
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"orders\""))).toBe(false);
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO \"payments\""))).toBe(false);
  });

  it("idempotent bundle order retries return the existing payment without double decrementing stock", async () => {
    const { requests } = installCreateOrderMutationMock({
      existingMode: true,
      activeTableContext: testTableContext(),
      menus: [testMenu({ id: "menu_bundle_0003", name: "Bundle", price: 15000, quantity: 99 })],
      existingOrder: {
        id: "ord_existing001",
        tableContextId: "ctx_12345678901",
        clientOrderId: "client-order-bundle-retry",
        displayNumber: 8,
        status: "ACTIVE",
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
      },
      existingPayment: {
        id: "pay_existing001",
        paid: 0,
        amount: 14999,
        status: "PENDING",
        paymentCode: 1,
        originalAmount: 15000,
        expectedTransferAmount: 14999,
        orderId: "ord_existing001",
        expiresAt: 9999999999999,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
      },
    });

    const { createClientOrder } = await import("~/lib/server/d1-mutations");
    const result = await createClientOrder(
      "table_e2e_00001",
      "ctx_12345678901",
      "client-order-bundle-retry",
      [{ menuId: "menu_bundle_0003", quantity: 1 }],
    );

    expect(result.status).toBe(200);
    expect(result.result).toEqual(expect.objectContaining({
      displayNumber: 8,
      payment: expect.objectContaining({
        id: "pay_existing001",
        originalAmount: 15000,
      }),
    }));
    expect(requests.some((request) => request.sql.startsWith("UPDATE menus SET quantity = quantity -"))).toBe(false);
  });

  it("GET /api/admin/first-order-rule returns the configured rule through the admin API", async () => {
    const getFirstOrderRule = vi.fn(async () => ({
      id: "default",
      enabled: true,
      requiredCount: 2,
      createdAt: 1,
      updatedAt: 1,
      menuCounts: [],
    }));
    vi.doMock("~/lib/server/d1-mutations", () => ({
      getFirstOrderRule,
      updateFirstOrderRule: vi.fn(),
    }));

    const { GET } = await import("~/app/api/admin/first-order-rule/route");
    const response = await GET(new Request("http://order.test/api/admin/first-order-rule"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: {
        id: "default",
        enabled: true,
        requiredCount: 2,
        createdAt: 1,
        updatedAt: 1,
        menuCounts: [],
      },
    });
    expect(getFirstOrderRule).toHaveBeenCalledTimes(1);
  });

  it("PUT /api/admin/first-order-rule stores menu-level count settings without a category", async () => {
    const updateFirstOrderRule = vi.fn(async (rule: {
      enabled: boolean;
      requiredCount: number;
      menuCounts: Array<{ menuId: string; countAs: number }>;
    }) => ({
      result: {
        id: "default",
        ...rule,
        createdAt: 1,
        updatedAt: 1,
        menuCounts: rule.menuCounts.map((menuCount: { menuId: string; countAs: number }) => ({
          ruleId: "default",
          ...menuCount,
          createdAt: 1,
          updatedAt: 1,
        })),
      },
      status: 200,
    }));
    vi.doMock("~/lib/server/d1-mutations", () => ({
      getFirstOrderRule: vi.fn(),
      updateFirstOrderRule,
    }));

    const rule = {
      enabled: true,
      requiredCount: 2,
      menuCounts: [
        { menuId: "menu_rule000003", countAs: 1 },
        { menuId: "menu_rule000004", countAs: 0 },
      ],
    };
    const { PUT } = await import("~/app/api/admin/first-order-rule/route");
    const response = await PUT(guardedJsonRequest(
      "http://order.test/api/admin/first-order-rule",
      "PUT",
      { rule },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      result: expect.objectContaining({
        enabled: true,
        requiredCount: 2,
        menuCounts: expect.arrayContaining([
          expect.objectContaining({ menuId: "menu_rule000003", countAs: 1 }),
          expect.objectContaining({ menuId: "menu_rule000004", countAs: 0 }),
        ]),
      }),
    }));
    expect(updateFirstOrderRule).toHaveBeenCalledWith(rule);
  });

  it("PUT /api/admin/first-order-rule rejects the old category-scoped payload shape", async () => {
    const updateFirstOrderRule = vi.fn();
    vi.doMock("~/lib/server/d1-mutations", () => ({
      getFirstOrderRule: vi.fn(),
      updateFirstOrderRule,
    }));

    const { PUT } = await import("~/app/api/admin/first-order-rule/route");
    const response = await PUT(guardedJsonRequest(
      "http://order.test/api/admin/first-order-rule",
      "PUT",
      {
        rule: {
          enabled: true,
          menuCategoryId: "cat_required00",
          requiredCount: 2,
          menuCounts: [],
        },
      },
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request" });
    expect(updateFirstOrderRule).not.toHaveBeenCalled();
  });

  it("updateFirstOrderRule creates the isolated rule tables when the DB has not migrated yet", async () => {
    const createdTables = new Set<string>();
    const { requests } = installD1FetchMock(({ sql, params }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success(createdTables.has(String(params[0])) ? [{ name: params[0] }] : []);
      }
      if (sql.startsWith("SELECT * FROM menus WHERE id IN")) {
        return d1Success([testMenu({ id: "menu_rule000005" })]);
      }
      if (sql.includes("CREATE TABLE IF NOT EXISTS firstOrderRules")) {
        createdTables.add("firstOrderRules");
        return d1Success([], { duration: 1, changes: 0 });
      }
      if (sql.includes("CREATE TABLE IF NOT EXISTS firstOrderRuleMenuCounts")) {
        createdTables.add("firstOrderRuleMenuCounts");
        return d1Success([], { duration: 1, changes: 0 });
      }
      if (sql.startsWith("INSERT INTO firstOrderRules")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "DELETE FROM firstOrderRuleMenuCounts WHERE ruleId = ?") {
        return d1Success([], { duration: 1, changes: 0 });
      }
      if (sql === "PRAGMA table_info(\"firstOrderRuleMenuCounts\")") {
        return tableInfo(["ruleId", "menuId", "countAs", "createdAt", "updatedAt"]);
      }
      if (sql.startsWith("INSERT INTO \"firstOrderRuleMenuCounts\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "SELECT * FROM firstOrderRules WHERE id = ? LIMIT 1") {
        return d1Success([{
          id: "default",
          enabled: 1,
          requiredCount: 2,
          createdAt: 1,
          updatedAt: 1,
        }]);
      }
      if (sql === "SELECT * FROM firstOrderRuleMenuCounts WHERE ruleId = ?") {
        return d1Success([{
          ruleId: "default",
          menuId: "menu_rule000005",
          countAs: 1,
          createdAt: 1,
          updatedAt: 1,
        }]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { updateFirstOrderRule } = await import("~/lib/server/d1-mutations");
    const result = await updateFirstOrderRule({
      enabled: true,
      requiredCount: 2,
      menuCounts: [{ menuId: "menu_rule000005", countAs: 1 }],
    });

    expect(result.status).toBe(200);
    expect(createdTables).toEqual(new Set(["firstOrderRules", "firstOrderRuleMenuCounts"]));
    expect(requests.some((request) => request.sql.startsWith("INSERT INTO firstOrderRules"))).toBe(true);
  });

  it("PUT /api/admin/menu-bundle accepts empty items to clear bundle composition", async () => {
    const updateMenuBundle = vi.fn(async () => ({
      result: { bundleMenuId: "menu_bundle0001", items: [] },
      status: 200,
    }));
    vi.doMock("~/lib/server/d1-mutations", () => ({
      updateMenuBundle,
    }));

    const { PUT } = await import("~/app/api/admin/menu-bundle/route");
    const response = await PUT(guardedJsonRequest(
      "http://order.test/api/admin/menu-bundle",
      "PUT",
      { bundleMenuId: "menu_bundle0001", items: [] },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      result: { bundleMenuId: "menu_bundle0001", items: [] },
    }));
    expect(updateMenuBundle).toHaveBeenCalledWith("menu_bundle0001", []);
  });

  it("PUT /api/admin/menu-bundle rejects invalid component quantities before mutation", async () => {
    const updateMenuBundle = vi.fn();
    vi.doMock("~/lib/server/d1-mutations", () => ({
      updateMenuBundle,
    }));

    const { PUT } = await import("~/app/api/admin/menu-bundle/route");
    const response = await PUT(guardedJsonRequest(
      "http://order.test/api/admin/menu-bundle",
      "PUT",
      {
        bundleMenuId: "menu_bundle0001",
        items: [{ componentMenuId: "menu_comp000001", quantity: 0 }],
      },
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request" });
    expect(updateMenuBundle).not.toHaveBeenCalled();
  });

  it("DELETE /api/order vacates the table context when the last unpaid order is cancelled", async () => {
    const { requests } = installD1FetchMock(({ sql, params }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success(params[0] === "tableContexts" ? [{ name: params[0] }] : []);
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
      if (sql === "PRAGMA table_info(\"tableContexts\")") {
        return tableInfo(["id", "tableId", "createdAt", "updatedAt", "deletedAt"]);
      }
      if (sql === "SELECT * FROM orders WHERE id = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([{
          id: "ord_pending0001",
          tableContextId: "ctx_first000001",
          clientOrderId: "client-order-first",
          displayNumber: 1,
          status: "ACTIVE",
          expiresAt: Date.now() + 1000,
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }]);
      }
      if (sql === "SELECT * FROM payments WHERE orderId = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([{
          id: "pay_pending0001",
          paid: 0,
          amount: 11999,
          status: "PENDING",
          paymentCode: 1,
          originalAmount: 12000,
          expectedTransferAmount: 11999,
          orderId: "ord_pending0001",
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }]);
      }
      if (sql === "SELECT * FROM menuOrders WHERE orderId = ? AND deletedAt IS NULL") {
        return d1Success([{
          id: "mo_pending00001",
          orderId: "ord_pending0001",
          menuId: "menu_e2e_000001",
          quantity: 1,
          status: "PENDING",
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
      if (sql.startsWith("SELECT tc.tableId")) {
        return d1Success([{ tableId: "table_e2e_00001" }]);
      }
      if (isTableContextBlockingOrderSql(sql)) {
        return d1Success([]);
      }
      if (sql.startsWith("UPDATE \"tableContexts\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { DELETE } = await import("~/app/api/order/route");
    const response = await DELETE(guardedJsonRequest(
      "http://order.test/api/order",
      "DELETE",
      { orderId: "ord_pending0001" },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ result: "Order Deleted" }));
    const tableContextUpdate = requests.find((request) => request.sql.startsWith("UPDATE \"tableContexts\""));
    expect(tableContextUpdate?.params[2]).toBe("ctx_first000001");
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
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({
      result: {
        bankTransactionId: expect.any(String),
        status: "AUTO_MATCHED",
        matchedPaymentId: "pay_e2e_000001",
        candidateCount: 1,
      },
      affectedScopes: expect.arrayContaining(["venue:default", "table:table_e2e_00001"]),
    }));
    const update = requests.find((request) => request.sql.startsWith("UPDATE \"payments\""));
    expect(update?.params).toContain(1);
    expect(update?.params).toContain("PAID");
    expect(update?.params).toContain("테스트은행");
    expect(update?.params).toContain("테스터");
    const domainEventInserts = requests.filter((request) => request.sql.startsWith("INSERT INTO domainEvents"));
    expect(domainEventInserts.map((request) => request.params[1])).toEqual(expect.arrayContaining([
      "venue:default",
      "table:table_e2e_00001",
    ]));
  });

  it("PUT /api/admin/deposit/confirm emits table sync for the matched payment", async () => {
    const { requests } = installD1FetchMock(({ sql }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success([{ name: "paymentCodeLeases" }]);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql === "PRAGMA table_info(\"bankTransactions\")") {
        return tableInfo(["id", "dedupeKey", "amount", "depositor", "receivedAt", "rawText", "source", "status", "matchedPaymentId", "createdAt"]);
      }
      if (sql === "SELECT * FROM bankTransactions WHERE id = ? LIMIT 1") {
        return d1Success([{
          id: "banktx_00000001",
          dedupeKey: "manual:1710000000000:23999:tester",
          amount: 23999,
          depositor: "테스터",
          receivedAt: 1710000000000,
          rawText: "테스트은행 테스터 23999",
          source: "테스트은행",
          status: "NEEDS_REVIEW",
          matchedPaymentId: null,
          createdAt: 1,
        }]);
      }
      if (sql === "SELECT * FROM payments WHERE id = ? AND deletedAt IS NULL LIMIT 1") {
        return d1Success([{
          id: "payment_0000001",
          paid: 0,
          amount: 23999,
          status: "PENDING",
          orderId: "order_e2e_0001",
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }]);
      }
      if (sql.startsWith("UPDATE \"payments\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "DELETE FROM paymentCodeLeases WHERE paymentId = ?") {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql.startsWith("UPDATE \"bankTransactions\"")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { PUT } = await import("~/app/api/admin/deposit/confirm/route");
    const response = await PUT(guardedJsonRequest(
      "http://order.test/api/admin/deposit/confirm",
      "PUT",
      {
        bankTransactionId: "banktx_00000001",
        paymentId: "payment_0000001",
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      result: "Payment matched",
      affectedScopes: expect.arrayContaining(["venue:default", "table:table_e2e_00001"]),
    }));
    const domainEventInserts = requests.filter((request) => request.sql.startsWith("INSERT INTO domainEvents"));
    expect(domainEventInserts.map((request) => request.params[1])).toEqual(expect.arrayContaining([
      "venue:default",
      "table:table_e2e_00001",
    ]));
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

  it("PUT /api/admin/payment-settings stores account guidance and emits table sync events", async () => {
    const { requests } = installD1FetchMock(({ sql }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql.includes("CREATE TABLE IF NOT EXISTS paymentSettings")) {
        return d1Success([], { duration: 1, changes: 0 });
      }
      if (sql === "SELECT * FROM paymentSettings WHERE id = ? LIMIT 1") {
        return d1Success([]);
      }
      if (sql.startsWith("INSERT INTO paymentSettings")) {
        return d1Success([], { duration: 1, changes: 1 });
      }
      if (sql === "SELECT id FROM tables WHERE deletedAt IS NULL") {
        return d1Success([{ id: "table_e2e_00001" }]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { PUT } = await import("~/app/api/admin/payment-settings/route");
    const response = await PUT(guardedJsonRequest(
      "http://order.test/api/admin/payment-settings",
      "PUT",
      {
        paymentSettings: {
          bankName: "테스트은행",
          accountNumber: "123-456-7890",
          accountHolder: "연컴 테스트",
          tossTransferUrlTemplate: "supertoss://send?amount={amount}&bank={bankName}&accountNo={accountNumber}",
          depositGuide: "테스트 입금 안내",
        },
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      result: expect.objectContaining({
        bankName: "테스트은행",
        accountNumber: "123-456-7890",
        accountHolder: "연컴 테스트",
        depositGuide: "테스트 입금 안내",
      }),
      affectedScopes: expect.arrayContaining(["venue:default", "table:table_e2e_00001"]),
    }));

    const upsert = requests.find((request) => request.sql.startsWith("INSERT INTO paymentSettings"));
    expect(upsert?.params).toEqual(expect.arrayContaining([
      "default",
      "테스트은행",
      "123-456-7890",
      "연컴 테스트",
      "테스트 입금 안내",
    ]));
    const domainEventInserts = requests.filter((request) => request.sql.startsWith("INSERT INTO domainEvents"));
    expect(domainEventInserts).toHaveLength(2);
    expect(domainEventInserts.map((request) => request.params[3])).toEqual([
      "paymentSettings.updated",
      "paymentSettings.updated",
    ]);
    expect(domainEventInserts.map((request) => request.params[1])).toEqual(expect.arrayContaining([
      "venue:default",
      "table:table_e2e_00001",
    ]));
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
    const { requests } = installD1FetchMock(({ sql, params }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success(params[0] === "paymentCodeLeases" ? [{ name: params[0] }] : []);
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

  it("PUT /api/admin/order/refund completes refund pending payments and vacates an empty table context", async () => {
    const { requests } = installD1FetchMock(({ sql, params }) => {
      const realtime = handleRealtimeSql(sql);
      if (realtime) return realtime;
      if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
        return d1Success(params[0] === "tableContexts" ? [{ name: params[0] }] : []);
      }
      if (sql === "PRAGMA table_info(\"payments\")") {
        return tableInfo(paymentColumns);
      }
      if (sql === "PRAGMA table_info(\"tableContexts\")") {
        return tableInfo(["id", "tableId", "createdAt", "updatedAt", "deletedAt"]);
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
      if (isTableContextBlockingOrderSql(sql)) {
        return d1Success([]);
      }
      if (sql.startsWith("UPDATE \"tableContexts\"")) {
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
    const tableContextUpdate = requests.find((request) => request.sql.startsWith("UPDATE \"tableContexts\""));
    expect(tableContextUpdate?.params[2]).toBe("ctx_12345678901");
  });
});
