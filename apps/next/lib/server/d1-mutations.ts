import { generateId } from "lucia";
import { bankTransactionStatus, menuOrderStatus, orderStatus, paymentStatus } from "db/schema";
import { executeD1, hasD1Table, queryD1 } from "~/lib/server/db";
import { revokeTableSessions } from "~/lib/server/table-session";
import { appendDomainEvent, tableScope, venueScope, type DomainEventRecord } from "~/lib/server/sync-events";

type BaseRow = {
  id: string;
  createdAt?: number | string;
  updatedAt?: number | string;
  deletedAt?: number | string | null;
};

type TableRow = BaseRow & {
  key: number;
  name: string;
  seats: number;
};

type TableContextRow = BaseRow & {
  tableId: string;
};

type OrderRow = BaseRow & {
  tableContextId: string;
  clientOrderId?: string | null;
  displayNumber?: number | null;
  status?: string | null;
  expiresAt?: number | string | null;
  cancelReason?: string | null;
  cancelledAt?: number | string | null;
  cancelledByUserId?: string | null;
};

type MenuRow = BaseRow & {
  name: string;
  price: number;
  quantity: number;
  available?: boolean | number;
  menuCategoryId: string;
};

type PaymentRow = BaseRow & {
  paid: boolean | number;
  amount: number;
  orderId?: string | null;
  bank?: string | null;
  depositor?: string | null;
  method?: string | null;
  status?: string | null;
  paymentCode?: number | null;
  originalAmount?: number | null;
  expectedTransferAmount?: number | null;
  expiresAt?: number | string | null;
  paidAt?: number | string | null;
  matchedBankTransactionId?: string | null;
  matchedBy?: string | null;
  depositorHint?: string | null;
  refundAmount?: number | null;
  refundRequestedAt?: number | string | null;
  refundedAt?: number | string | null;
  refundHandledByUserId?: string | null;
  refundNote?: string | null;
};

type MenuOrderRow = BaseRow & {
  quantity: number;
  status: string;
  orderId: string;
  menuId: string;
};

type MutationResult = {
  result?: unknown;
  error?: string;
  status: number;
  tableContextId?: string;
  mutationId?: string;
  revision?: number;
  affectedScopes?: string[];
  events?: DomainEventRecord[];
};

type CreateOrderResult = {
  orderId: string;
  displayNumber: number | null;
  payment: {
    id: string;
    status: string;
    originalAmount: number | null;
    paymentCode: number | null;
    expectedTransferAmount: number | null;
    expiresAt: number | null;
  };
};

type MenuOrderInput = {
  menuId: string;
  quantity: number;
};

type BankTransactionInput = {
  amount: number;
  bank: string;
  depositor: string;
  timestamp: number;
  rawText?: string;
  source?: string;
  dedupeKey?: string;
};

const paymentCodeMin = 1;
const paymentCodeMax = 99;
const pendingOrderTtlMs = 5 * 60 * 1000;
const activePaymentStatuses = [paymentStatus.PENDING, paymentStatus.MANUAL_REVIEW];

let tableContextTableName: string | null = null;
const columnCache = new Map<string, Set<string>>();
let defaultUserId: string | null | undefined;

export function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

export async function getTableContextTableName() {
  if (tableContextTableName) {
    return tableContextTableName;
  }

  if (await hasD1Table("tableContexts")) {
    tableContextTableName = "tableContexts";
    return tableContextTableName;
  }

  if (await hasD1Table("tableContext")) {
    tableContextTableName = "tableContext";
    return tableContextTableName;
  }

  throw new Error("No table context table found.");
}

export async function getD1Columns(tableName: string) {
  const cached = columnCache.get(tableName);
  if (cached) {
    return cached;
  }

  const rows = await queryD1<{ name: string }>(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
  const columns = new Set(rows.map((row) => row.name));
  columnCache.set(tableName, columns);
  return columns;
}

async function getDefaultUserId() {
  if (defaultUserId !== undefined) {
    return defaultUserId;
  }

  const userColumns = await getD1Columns("users");
  const where = userColumns.has("deletedAt") ? "WHERE deletedAt IS NULL" : "";
  const rows = await queryD1<{ id: string }>(
    `SELECT id FROM users ${where} ORDER BY CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END, createdAt LIMIT 1`,
  );

  defaultUserId = rows[0]?.id ?? null;
  return defaultUserId;
}

async function withUserIdIfNeeded(tableName: string, row: Record<string, unknown>) {
  const columns = await getD1Columns(tableName);

  if (!columns.has("userId") || row.userId !== undefined) {
    return row;
  }

  const userId = await getDefaultUserId();
  return userId ? { ...row, userId } : row;
}

export async function insertD1Row(tableName: string, row: Record<string, unknown>) {
  const rowWithUser = await withUserIdIfNeeded(tableName, row);
  const columns = await getD1Columns(tableName);
  const insertColumns = Object.keys(rowWithUser).filter((column) => columns.has(column));
  const columnSql = insertColumns.map(quoteIdentifier).join(", ");
  const placeholders = insertColumns.map(() => "?").join(", ");

  return await executeD1(
    `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES (${placeholders})`,
    insertColumns.map((column) => rowWithUser[column]),
  );
}

export async function updateD1Rows(
  tableName: string,
  values: Record<string, unknown>,
  whereSql: string,
  params: unknown[],
) {
  const columns = await getD1Columns(tableName);
  const updateColumns = Object.keys(values).filter((column) => columns.has(column));

  if (updateColumns.length === 0) {
    return;
  }

  const setSql = updateColumns.map((column) => `${quoteIdentifier(column)} = ?`).join(", ");
  return await executeD1(
    `UPDATE ${quoteIdentifier(tableName)} SET ${setSql} WHERE ${whereSql}`,
    [...updateColumns.map((column) => values[column]), ...params],
  );
}

export function newId() {
  return generateId(15);
}

export function now() {
  return Date.now();
}

async function withDomainEvent(
  result: MutationResult,
  {
    type,
    scopes,
    entityType,
    entityId,
    payload,
    mutationId = newId(),
  }: {
    type: string;
    scopes: string[];
    entityType?: string | null;
    entityId?: string | null;
    payload?: unknown;
    mutationId?: string;
  },
) {
  if (result.error) return result;
  const affectedScopes = [...new Set(scopes)];
  const events = await appendDomainEvent({
    scopes: affectedScopes,
    type,
    entityType,
    entityId,
    payload,
    mutationId,
  });

  return {
    ...result,
    mutationId,
    affectedScopes,
    revision: Math.max(...events.map((event) => event.revision), 0),
    events,
  };
}

async function getTableIdForOrder(orderId: string) {
  const [row] = await queryD1<{ tableId: string }>(
    `SELECT tc.tableId
     FROM orders o
     INNER JOIN tableContexts tc ON tc.id = o.tableContextId
     WHERE o.id = ?
     LIMIT 1`,
    [orderId],
  );
  return row?.tableId ?? null;
}

async function getTableIdForMenuOrder(menuOrderId: string) {
  const [row] = await queryD1<{ tableId: string; orderId: string }>(
    `SELECT tc.tableId, mo.orderId
     FROM menuOrders mo
     INNER JOIN orders o ON o.id = mo.orderId
     INNER JOIN tableContexts tc ON tc.id = o.tableContextId
     WHERE mo.id = ?
     LIMIT 1`,
    [menuOrderId],
  );
  return row ?? null;
}

export function aggregateMenuOrders(menuOrders: MenuOrderInput[]) {
  const aggregated = new Map<string, number>();

  for (const menuOrder of menuOrders) {
    aggregated.set(menuOrder.menuId, (aggregated.get(menuOrder.menuId) ?? 0) + menuOrder.quantity);
  }

  return [...aggregated.entries()].map(([menuId, quantity]) => ({ menuId, quantity }));
}

function placeholders(length: number) {
  return Array.from({ length }, () => "?").join(", ");
}

export async function findActiveTableContext(tableId: string) {
  const contextTable = await getTableContextTableName();
  const contexts = await queryD1<TableContextRow>(
    `SELECT * FROM ${quoteIdentifier(contextTable)} WHERE tableId = ? AND deletedAt IS NULL LIMIT 1`,
    [tableId],
  );

  return contexts[0] ?? null;
}

export async function findActiveTableContextById(tableId: string, tableContextId: string) {
  const contextTable = await getTableContextTableName();
  const contexts = await queryD1<TableContextRow>(
    `SELECT * FROM ${quoteIdentifier(contextTable)} WHERE id = ? AND tableId = ? AND deletedAt IS NULL LIMIT 1`,
    [tableContextId, tableId],
  );

  return contexts[0] ?? null;
}

export async function createTableContext(tableId: string) {
  const timestamp = now();
  const contextTable = await getTableContextTableName();
  const context: TableContextRow = {
    id: newId(),
    tableId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };

  await insertD1Row(contextTable, context);
  await mirrorLegacyTableContext(contextTable, context);
  return context;
}

async function mirrorLegacyTableContext(contextTable: string, context: TableContextRow) {
  if (contextTable !== "tableContexts" || !(await hasD1Table("tableContext"))) {
    return;
  }

  await insertD1Row("tableContext", context);
}

async function closeTableContext(tableContextId: string, timestamp = now()) {
  const contextTable = await getTableContextTableName();
  const values = { deletedAt: timestamp, updatedAt: timestamp };
  await updateD1Rows(contextTable, values, "id = ?", [tableContextId]);
  await updateLegacyTableContextMirror(contextTable, values, "id = ?", [tableContextId]);
}

async function updateLegacyTableContextMirror(
  contextTable: string,
  values: Record<string, unknown>,
  whereSql: string,
  params: unknown[],
) {
  if (contextTable !== "tableContexts" || !(await hasD1Table("tableContext"))) {
    return;
  }

  await updateD1Rows("tableContext", values, whereSql, params);
}

async function paymentUsesOrderIdColumn() {
  const paymentColumns = await getD1Columns("payments");
  return paymentColumns.has("orderId");
}

async function paymentJoinSql(orderAlias = "o", paymentAlias = "p") {
  return (await paymentUsesOrderIdColumn())
    ? `${paymentAlias}.orderId = ${orderAlias}.id`
    : `${paymentAlias}.id = ${orderAlias}.id`;
}

async function paymentWhereForOrder(orderId: string) {
  return (await paymentUsesOrderIdColumn())
    ? { sql: "orderId = ?", params: [orderId] }
    : { sql: "id = ?", params: [orderId] };
}

async function getPaymentForOrder(orderId: string) {
  const where = await paymentWhereForOrder(orderId);
  const payments = await queryD1<PaymentRow>(
    `SELECT * FROM payments WHERE ${where.sql} AND deletedAt IS NULL LIMIT 1`,
    where.params,
  );

  return payments[0] ?? null;
}

function normalizeNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isPaymentPaid(payment: PaymentRow | null | undefined) {
  return (
    payment?.status === paymentStatus.PAID ||
    payment?.status === paymentStatus.REFUND_PENDING ||
    payment?.paid === true ||
    payment?.paid === 1
  );
}

function isActiveUnpaidPayment(payment: PaymentRow | null | undefined) {
  if (!payment || isPaymentPaid(payment)) {
    return false;
  }

  const status = payment.status ?? paymentStatus.PENDING;
  return activePaymentStatuses.includes(status as typeof activePaymentStatuses[number]);
}

function buildCreateOrderResult(order: Pick<OrderRow, "id" | "displayNumber">, payment: PaymentRow): CreateOrderResult {
  return {
    orderId: order.id,
    displayNumber: order.displayNumber ?? null,
    payment: {
      id: payment.id,
      status: payment.status ?? (isPaymentPaid(payment) ? paymentStatus.PAID : paymentStatus.PENDING),
      originalAmount: payment.originalAmount ?? payment.amount ?? null,
      paymentCode: payment.paymentCode ?? null,
      expectedTransferAmount: payment.expectedTransferAmount ?? payment.amount ?? null,
      expiresAt: normalizeNumber(payment.expiresAt),
    },
  };
}

async function getExistingOrderByClientOrderId(clientOrderId: string) {
  const orderColumns = await getD1Columns("orders");
  if (!orderColumns.has("clientOrderId")) {
    return null;
  }

  const order = (await queryD1<OrderRow>(
    "SELECT * FROM orders WHERE clientOrderId = ? AND deletedAt IS NULL LIMIT 1",
    [clientOrderId],
  ))[0];

  if (!order) {
    return null;
  }

  const payment = await getPaymentForOrder(order.id);
  return payment ? { result: buildCreateOrderResult(order, payment), tableContextId: order.tableContextId } : null;
}

async function getNextDisplayNumber() {
  const orderColumns = await getD1Columns("orders");
  if (!orderColumns.has("displayNumber")) {
    return null;
  }

  const rows = await queryD1<{ nextDisplayNumber: number | null }>(
    "SELECT COALESCE(MAX(displayNumber), 0) + 1 AS nextDisplayNumber FROM orders",
  );
  return rows[0]?.nextDisplayNumber ?? 1;
}

async function releasePaymentCodeLease(paymentId: string) {
  if (!(await hasD1Table("paymentCodeLeases"))) {
    return;
  }

  await executeD1("DELETE FROM paymentCodeLeases WHERE paymentId = ?", [paymentId]);
}

async function expireStalePaymentCodeLeases(timestamp: number) {
  if (!(await hasD1Table("paymentCodeLeases"))) {
    return;
  }

  await executeD1("DELETE FROM paymentCodeLeases WHERE expiresAt <= ?", [timestamp]);
}

export async function expireStalePendingOrders(timestamp = now()) {
  const paymentColumns = await getD1Columns("payments");
  if (!paymentColumns.has("expiresAt")) {
    return;
  }

  const expiredPayments = await queryD1<PaymentRow>(
    `SELECT * FROM payments WHERE deletedAt IS NULL AND paid = 0 AND expiresAt IS NOT NULL AND expiresAt <= ? AND COALESCE(status, ?) IN (?, ?)`,
    [timestamp, paymentStatus.PENDING, paymentStatus.PENDING, paymentStatus.MANUAL_REVIEW],
  );

  for (const payment of expiredPayments) {
    const orderId = payment.orderId ?? payment.id;
    await cancelOrder(orderId, { allowPaid: false, terminalStatus: paymentStatus.EXPIRED, orderTerminalStatus: orderStatus.EXPIRED });
  }

  await expireStalePaymentCodeLeases(timestamp);
}

async function allocatePaymentCode(paymentId: string, originalAmount: number, expiresAt: number) {
  await expireStalePaymentCodeLeases(now());

  const paymentColumns = await getD1Columns("payments");
  const hasPaymentCodeColumns =
    paymentColumns.has("paymentCode") && paymentColumns.has("expectedTransferAmount");

  if (!hasPaymentCodeColumns) {
    return {
      code: null,
      expectedTransferAmount: originalAmount,
    };
  }

  const activePayments = await queryD1<PaymentRow>(
    `SELECT * FROM payments WHERE deletedAt IS NULL AND paid = 0 AND COALESCE(status, ?) IN (?, ?)`,
    [paymentStatus.PENDING, paymentStatus.PENDING, paymentStatus.MANUAL_REVIEW],
  );
  const usedCodes = new Set(activePayments.map((payment) => payment.paymentCode).filter((code): code is number => code !== null && code !== undefined));
  const usedExpectedAmounts = new Set(activePayments.map((payment) => payment.expectedTransferAmount ?? payment.amount));
  const leaseTableExists = await hasD1Table("paymentCodeLeases");

  for (const allowExpectedAmountCollision of [false, true]) {
    for (let code = paymentCodeMin; code <= paymentCodeMax; code += 1) {
      const expectedTransferAmount = originalAmount - code;

      if (usedCodes.has(code)) {
        continue;
      }

      if (!allowExpectedAmountCollision && usedExpectedAmounts.has(expectedTransferAmount)) {
        continue;
      }

      if (!leaseTableExists) {
        return { code, expectedTransferAmount };
      }

      const inserted = await executeD1(
        "INSERT OR IGNORE INTO paymentCodeLeases (code, paymentId, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
        [code, paymentId, expiresAt, now()],
      );

      if (!inserted || inserted.changed > 0) {
        return { code, expectedTransferAmount };
      }
    }
  }

  return null;
}

async function restoreStock(menuOrders: MenuOrderInput[], timestamp = now()) {
  for (const menuOrder of menuOrders) {
    await executeD1(
      "UPDATE menus SET quantity = quantity + ?, updatedAt = ? WHERE id = ?",
      [menuOrder.quantity, timestamp, menuOrder.menuId],
    );
  }
}

async function markPaymentPaidById(
  paymentId: string,
  options: {
    bank?: string;
    depositor?: string;
    timestamp?: number;
    matchedBankTransactionId?: string | null;
    matchedBy?: string;
  } = {},
) {
  const timestamp = options.timestamp ?? now();
  await updateD1Rows(
    "payments",
    {
      paid: 1,
      status: paymentStatus.PAID,
      bank: options.bank ?? "수동 확인",
      depositor: options.depositor ?? "관리자",
      method: `${options.bank ?? "수동 확인"} ${options.depositor ?? "관리자"}`,
      paidAt: timestamp,
      matchedBankTransactionId: options.matchedBankTransactionId ?? null,
      matchedBy: options.matchedBy ?? "MANUAL",
      updatedAt: timestamp,
    },
    "id = ?",
    [paymentId],
  );
  await releasePaymentCodeLease(paymentId);
}

export async function createClientOrder(
  tableId: string,
  tableContextId: string,
  clientOrderId: string,
  menuOrders: MenuOrderInput[],
): Promise<MutationResult> {
  return await createClientOrderInternal(tableId, clientOrderId, menuOrders, {
    kind: "existing",
    tableContextId,
  });
}

export async function createClientOrderForNewTableSession(
  tableId: string,
  clientOrderId: string,
  menuOrders: MenuOrderInput[],
): Promise<MutationResult> {
  return await createClientOrderInternal(tableId, clientOrderId, menuOrders, {
    kind: "new-session",
  });
}

async function createClientOrderInternal(
  tableId: string,
  clientOrderId: string,
  menuOrders: MenuOrderInput[],
  mode: { kind: "existing"; tableContextId: string } | { kind: "new-session" },
): Promise<MutationResult> {
  const requestedMenuOrders = aggregateMenuOrders(menuOrders);

  if (requestedMenuOrders.length === 0) {
    return { error: "Invalid request", status: 400 };
  }

  await expireStalePendingOrders();

  const existingOrder = await getExistingOrderByClientOrderId(clientOrderId);
  if (existingOrder) {
    return { result: existingOrder.result, tableContextId: existingOrder.tableContextId, status: 200 };
  }

  const table = (await queryD1<TableRow>(
    "SELECT * FROM tables WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [tableId],
  ))[0];

  if (!table) {
    return { error: "Table Not Found", status: 409 };
  }

  let tableContext: TableContextRow | null = null;
  if (mode.kind === "existing") {
    tableContext = await findActiveTableContextById(tableId, mode.tableContextId);
    if (!tableContext) {
      return { error: "Invalid table session", status: 403 };
    }

    const paymentJoin = await paymentJoinSql("o", "p");
    const activeOrders = await queryD1<{ id: string; paid: boolean | number | null; status?: string | null; paymentStatus?: string | null }>(
      `SELECT o.id, o.status, p.paid, p.status AS paymentStatus FROM orders o LEFT JOIN payments p ON ${paymentJoin} AND p.deletedAt IS NULL WHERE o.tableContextId = ? AND o.deletedAt IS NULL AND COALESCE(o.status, ?) NOT IN (?, ?)`,
      [tableContext.id, orderStatus.ACTIVE, orderStatus.CANCELLED, orderStatus.EXPIRED],
    );

    const inactivePaymentStatuses: string[] = [paymentStatus.CANCELLED, paymentStatus.EXPIRED];
    if (activeOrders.some((order) => order.paid !== true && order.paid !== 1 && !inactivePaymentStatuses.includes(String(order.paymentStatus)))) {
      return { error: "Unpaid Order Exists", status: 409 };
    }
  } else if (await findActiveTableContext(tableId)) {
    return { error: "Table already in use", status: 403 };
  }

  const menuIds = requestedMenuOrders.map((menuOrder) => menuOrder.menuId);
  const menus = await queryD1<MenuRow>(
    `SELECT * FROM menus WHERE id IN (${placeholders(menuIds.length)}) AND deletedAt IS NULL`,
    menuIds,
  );
  const menusById = new Map(menus.map((menu) => [menu.id, menu]));

  if (menus.length !== menuIds.length) {
    return { error: "Menu Not Found", status: 409 };
  }

  for (const menuOrder of requestedMenuOrders) {
    const menu = menusById.get(menuOrder.menuId);

    if (!menu || menu.quantity < menuOrder.quantity || menu.available === false || menu.available === 0) {
      return { error: "Menu Not Enough", status: 409 };
    }
  }

  const timestamp = now();
  const expiresAt = timestamp + pendingOrderTtlMs;
  const orderId = newId();
  const paymentHasOrderId = await paymentUsesOrderIdColumn();
  const paymentId = paymentHasOrderId ? newId() : orderId;
  const originalAmount = requestedMenuOrders.reduce((total, menuOrder) => {
    const menu = menusById.get(menuOrder.menuId);
    return total + (menu?.price ?? 0) * menuOrder.quantity;
  }, 0);
  const paymentCode = await allocatePaymentCode(paymentId, originalAmount, expiresAt);

  if (!paymentCode) {
    return { error: "Payment Code Exhausted", status: 409 };
  }

  const deducted: MenuOrderInput[] = [];
  let createdTableContext: TableContextRow | null = null;

  try {
    for (const menuOrder of requestedMenuOrders) {
      const result = await executeD1(
        "UPDATE menus SET quantity = quantity - ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL AND available = 1 AND quantity >= ?",
        [menuOrder.quantity, timestamp, menuOrder.menuId, menuOrder.quantity],
      );

      if (result.changed <= 0) {
        await restoreStock(deducted, timestamp);
        await releasePaymentCodeLease(paymentId);
        return { error: "Menu Not Enough", status: 409 };
      }

      deducted.push(menuOrder);
    }

    if (mode.kind === "new-session") {
      if (await findActiveTableContext(tableId)) {
        await restoreStock(deducted, timestamp);
        await releasePaymentCodeLease(paymentId);
        return { error: "Table already in use", status: 403 };
      }
      createdTableContext = await createTableContext(tableId);
      tableContext = createdTableContext;
    }

    if (!tableContext) {
      await restoreStock(deducted, timestamp);
      await releasePaymentCodeLease(paymentId);
      return { error: "Invalid table session", status: 403 };
    }

    const displayNumber = await getNextDisplayNumber();

    await insertD1Row("orders", {
      id: orderId,
      clientOrderId,
      displayNumber,
      status: orderStatus.ACTIVE,
      expiresAt,
      tableContextId: tableContext.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });

    for (const menuOrder of requestedMenuOrders) {
      await insertD1Row("menuOrders", {
        id: newId(),
        orderId,
        menuId: menuOrder.menuId,
        quantity: menuOrder.quantity,
        status: menuOrderStatus.PENDING,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      });
    }

    const payment: PaymentRow = {
      id: paymentId,
      paid: 0,
      amount: paymentCode.expectedTransferAmount,
      status: paymentStatus.PENDING,
      paymentCode: paymentCode.code,
      originalAmount,
      expectedTransferAmount: paymentCode.expectedTransferAmount,
      expiresAt,
      paidAt: null,
      matchedBankTransactionId: null,
      matchedBy: null,
      depositorHint: null,
      bank: null,
      depositor: null,
      orderId,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await insertD1Row("payments", {
      ...payment,
      method: "미결제",
    });

      return await withDomainEvent({
        result: buildCreateOrderResult({ id: orderId, displayNumber }, payment),
        status: 200,
        tableContextId: tableContext.id,
      }, {
        type: "order.created",
        scopes: [venueScope, tableScope(tableId)],
        entityType: "order",
        entityId: orderId,
        payload: { tableId, orderId, paymentId },
      });
  } catch (error) {
    await restoreStock(deducted, timestamp);
    await releasePaymentCodeLease(paymentId);
    if (createdTableContext) {
      await closeTableContext(createdTableContext.id, timestamp);
    }
    throw error;
  }
}

export async function cancelOrder(
  orderId: string,
  options: {
    allowPaid: boolean;
    terminalStatus?: typeof paymentStatus.CANCELLED | typeof paymentStatus.EXPIRED;
    orderTerminalStatus?: typeof orderStatus.CANCELLED | typeof orderStatus.EXPIRED;
    adminUserId?: string | null;
    cancelReason?: string | null;
  },
): Promise<MutationResult> {
  const order = (await queryD1<OrderRow>(
    "SELECT * FROM orders WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [orderId],
  ))[0];

  if (!order) {
    return { error: "Order Not Found", status: 403 };
  }

  const payment = await getPaymentForOrder(orderId);

  if (!options.allowPaid && payment && (payment.paid === true || payment.paid === 1)) {
    return { error: "Paid Order Cannot Be Deleted", status: 403 };
  }

  const menuOrders = await queryD1<MenuOrderRow>(
    "SELECT * FROM menuOrders WHERE orderId = ? AND deletedAt IS NULL",
    [orderId],
  );
  const timestamp = now();
  const terminalPaymentStatus = options.terminalStatus ?? paymentStatus.CANCELLED;
  const terminalOrderStatus = options.orderTerminalStatus ?? orderStatus.CANCELLED;
  const currentPaymentStatus = payment?.status ?? (isPaymentPaid(payment) ? paymentStatus.PAID : paymentStatus.PENDING);

  if (options.allowPaid && payment && isPaymentPaid(payment) && terminalPaymentStatus === paymentStatus.CANCELLED) {
    if (currentPaymentStatus === paymentStatus.REFUND_PENDING) {
      return { error: "Refund Already Pending", status: 409 };
    }

    if (currentPaymentStatus === paymentStatus.REFUNDED) {
      return { error: "Order Already Refunded", status: 409 };
    }

    if (currentPaymentStatus !== paymentStatus.PAID) {
      return { error: "Paid Order Cannot Be Deleted", status: 403 };
    }

    const cancelReason = options.cancelReason?.trim();
    if (!cancelReason) {
      return { error: "Cancel Reason Required", status: 400 };
    }

    if (menuOrders.some((menuOrder) => menuOrder.status === menuOrderStatus.PICKED_UP)) {
      return { error: "Picked Up Order Cannot Be Cancelled", status: 409 };
    }

    const shouldRestoreStock = menuOrders.length > 0 && menuOrders.every((menuOrder) => menuOrder.status === menuOrderStatus.PENDING);
    if (shouldRestoreStock) {
      for (const menuOrder of menuOrders) {
        await queryD1(
          "UPDATE menus SET quantity = quantity + ?, updatedAt = ? WHERE id = ?",
          [menuOrder.quantity, timestamp, menuOrder.menuId],
        );
      }
    }

    await updateD1Rows(
      "menuOrders",
      { status: menuOrderStatus.CANCELLED, updatedAt: timestamp },
      "orderId = ?",
      [orderId],
    );

    const paymentWhere = await paymentWhereForOrder(orderId);
    await updateD1Rows(
      "payments",
      {
        paid: 1,
        status: paymentStatus.REFUND_PENDING,
        refundAmount: payment.expectedTransferAmount ?? payment.amount,
        refundRequestedAt: timestamp,
        updatedAt: timestamp,
      },
      paymentWhere.sql,
      paymentWhere.params,
    );
    await updateD1Rows(
      "orders",
      {
        status: orderStatus.CANCELLED,
        cancelReason,
        cancelledAt: timestamp,
        cancelledByUserId: options.adminUserId ?? null,
        updatedAt: timestamp,
      },
      "id = ?",
      [orderId],
    );
    await releasePaymentCodeLease(payment.id);

    const tableId = await getTableIdForOrder(orderId);
    return await withDomainEvent(
      { result: "Order cancelled; refund pending", status: 200 },
      {
        type: "order.cancelled",
        scopes: [venueScope, ...(tableId ? [tableScope(tableId)] : [])],
        entityType: "order",
        entityId: orderId,
        payload: { tableId, refundPending: true },
      },
    );
  }

  for (const menuOrder of menuOrders) {
    await queryD1(
      "UPDATE menus SET quantity = quantity + ?, updatedAt = ? WHERE id = ?",
      [menuOrder.quantity, timestamp, menuOrder.menuId],
    );
  }

  await updateD1Rows(
    "menuOrders",
    { status: menuOrderStatus.CANCELLED, deletedAt: timestamp, updatedAt: timestamp },
    "orderId = ?",
    [orderId],
  );

  const paymentWhere = await paymentWhereForOrder(orderId);
  await updateD1Rows(
    "payments",
    {
      paid: 0,
      status: terminalPaymentStatus,
      deletedAt: timestamp,
      updatedAt: timestamp,
    },
    paymentWhere.sql,
    paymentWhere.params,
  );
  await updateD1Rows(
    "orders",
    {
      status: terminalOrderStatus,
      cancelReason: options.cancelReason?.trim() || null,
      cancelledAt: terminalOrderStatus === orderStatus.CANCELLED ? timestamp : null,
      cancelledByUserId: options.adminUserId ?? null,
      deletedAt: timestamp,
      updatedAt: timestamp,
    },
    "id = ?",
    [orderId],
  );
  if (payment) {
    await releasePaymentCodeLease(payment.id);
  }

  const tableId = await getTableIdForOrder(orderId);
  return await withDomainEvent(
    { result: "Order Deleted", status: 200 },
    {
      type: terminalOrderStatus === orderStatus.EXPIRED ? "order.expired" : "order.cancelled",
      scopes: [venueScope, ...(tableId ? [tableScope(tableId)] : [])],
      entityType: "order",
      entityId: orderId,
      payload: { tableId, terminalPaymentStatus, terminalOrderStatus },
    },
  );
}

type BankTransactionCandidate = {
  paymentId: string;
  orderId: string;
  tableName: string;
  displayNumber: number | null;
  paymentCode: number | null;
  originalAmount: number;
  expectedTransferAmount: number;
  diff: number;
  reason: string;
};

type BankTransactionRow = {
  id: string;
  amount: number;
  depositor: string;
  receivedAt: number | string;
  rawText: string;
  source: string;
  status: string;
  matchedPaymentId?: string | null;
  createdAt: number | string;
};

function makeBankTransactionDedupeKey(input: BankTransactionInput) {
  return input.dedupeKey ?? [
    input.source ?? "MANUAL",
    input.timestamp,
    input.amount,
    input.depositor.trim(),
    input.rawText?.trim() ?? "",
  ].join(":");
}

async function findPaymentCandidates(amount: number): Promise<BankTransactionCandidate[]> {
  const contextTable = await getTableContextTableName();
  const paymentJoin = await paymentJoinSql("o", "p");
  const rows = await queryD1<PaymentRow & {
    orderId: string;
    tableName: string;
    displayNumber?: number | null;
  }>(
    `SELECT p.*, o.id AS orderId, o.displayNumber, t.name AS tableName
     FROM payments p
     INNER JOIN orders o ON ${paymentJoin}
     INNER JOIN ${quoteIdentifier(contextTable)} tc ON tc.id = o.tableContextId
     INNER JOIN tables t ON t.id = tc.tableId
     WHERE p.deletedAt IS NULL
       AND o.deletedAt IS NULL
       AND p.paid = 0
       AND COALESCE(p.status, ?) IN (?, ?)`,
    [paymentStatus.PENDING, paymentStatus.PENDING, paymentStatus.MANUAL_REVIEW],
  );

  return rows.flatMap((payment) => {
    const expectedTransferAmount = payment.expectedTransferAmount ?? payment.amount;
    const originalAmount = payment.originalAmount ?? payment.amount;
    const candidates: BankTransactionCandidate[] = [];

    if (amount === expectedTransferAmount) {
      candidates.push({
        paymentId: payment.id,
        orderId: payment.orderId,
        tableName: payment.tableName,
        displayNumber: payment.displayNumber ?? null,
        paymentCode: payment.paymentCode ?? null,
        originalAmount,
        expectedTransferAmount,
        diff: 0,
        reason: "EXPECTED_AMOUNT",
      });
    } else if (amount === originalAmount) {
      candidates.push({
        paymentId: payment.id,
        orderId: payment.orderId,
        tableName: payment.tableName,
        displayNumber: payment.displayNumber ?? null,
        paymentCode: payment.paymentCode ?? null,
        originalAmount,
        expectedTransferAmount,
        diff: amount - expectedTransferAmount,
        reason: "ORIGINAL_AMOUNT",
      });
    } else if (Math.abs(amount - expectedTransferAmount) < 100) {
      candidates.push({
        paymentId: payment.id,
        orderId: payment.orderId,
        tableName: payment.tableName,
        displayNumber: payment.displayNumber ?? null,
        paymentCode: payment.paymentCode ?? null,
        originalAmount,
        expectedTransferAmount,
        diff: amount - expectedTransferAmount,
        reason: "WITHIN_100",
      });
    }

    return candidates;
  });
}

export async function ingestBankTransaction(input: BankTransactionInput): Promise<MutationResult> {
  const transactionId = newId();
  const timestamp = now();
  const dedupeKey = makeBankTransactionDedupeKey(input);
  const candidates = await findPaymentCandidates(input.amount);
  const exactCandidates = candidates.filter((candidate) => candidate.reason === "EXPECTED_AMOUNT");
  const autoCandidate = exactCandidates.length === 1 ? exactCandidates[0] : null;
  const status = autoCandidate
    ? bankTransactionStatus.AUTO_MATCHED
    : candidates.length > 0
      ? bankTransactionStatus.NEEDS_REVIEW
      : bankTransactionStatus.UNMATCHED;

  const existing = (await queryD1<BankTransactionRow>(
    "SELECT * FROM bankTransactions WHERE dedupeKey = ? LIMIT 1",
    [dedupeKey],
  ))[0];

  if (existing) {
    return {
      result: {
        bankTransactionId: existing.id,
        status: existing.status,
        matchedPaymentId: existing.matchedPaymentId ?? null,
        candidateCount: candidates.length,
      },
      status: 200,
    };
  }

  await insertD1Row("bankTransactions", {
    id: transactionId,
    dedupeKey,
    amount: input.amount,
    depositor: input.depositor,
    receivedAt: input.timestamp,
    rawText: input.rawText ?? `${input.bank} ${input.depositor} ${input.amount}`,
    source: input.source ?? "MANUAL",
    status,
    matchedPaymentId: autoCandidate?.paymentId ?? null,
    createdAt: timestamp,
  });

  if (autoCandidate) {
    await markPaymentPaidById(autoCandidate.paymentId, {
      bank: input.bank,
      depositor: input.depositor,
      timestamp: input.timestamp,
      matchedBankTransactionId: transactionId,
      matchedBy: "AUTO_MATCHED",
    });
  }

  return await withDomainEvent({
    result: {
      bankTransactionId: transactionId,
      status,
      matchedPaymentId: autoCandidate?.paymentId ?? null,
      candidateCount: candidates.length,
    },
    status: 200,
  }, {
    type: autoCandidate ? "bankTransaction.autoMatched" : "bankTransaction.ingested",
    scopes: [venueScope],
    entityType: "bankTransaction",
    entityId: transactionId,
    payload: { paymentId: autoCandidate?.paymentId ?? null, amount: input.amount, status },
  });
}

export async function getPendingBankTransactions(): Promise<MutationResult> {
  const transactions = await queryD1<BankTransactionRow>(
    "SELECT * FROM bankTransactions WHERE status IN (?, ?) ORDER BY receivedAt DESC, createdAt DESC",
    [bankTransactionStatus.NEEDS_REVIEW, bankTransactionStatus.UNMATCHED],
  );

  return {
    result: {
      transactions: await Promise.all(transactions.map(async (transaction) => ({
        id: transaction.id,
        amount: transaction.amount,
        depositor: transaction.depositor,
        receivedAt: normalizeNumber(transaction.receivedAt) ?? 0,
        rawText: transaction.rawText,
        source: transaction.source,
        status: transaction.status,
        matchedPaymentId: transaction.matchedPaymentId ?? null,
        createdAt: normalizeNumber(transaction.createdAt) ?? 0,
        candidates: await findPaymentCandidates(transaction.amount),
      }))),
    },
    status: 200,
  };
}

export async function confirmBankTransaction(bankTransactionId: string, paymentId: string): Promise<MutationResult> {
  const transaction = (await queryD1<BankTransactionRow>(
    "SELECT * FROM bankTransactions WHERE id = ? LIMIT 1",
    [bankTransactionId],
  ))[0];

  if (!transaction) {
    return { error: "Bank Transaction Not Found", status: 404 };
  }

  const payment = (await queryD1<PaymentRow>(
    "SELECT * FROM payments WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [paymentId],
  ))[0];

  if (!payment) {
    return { error: "Payment Not Found", status: 404 };
  }

  await markPaymentPaidById(paymentId, {
    bank: transaction.source,
    depositor: transaction.depositor,
    timestamp: normalizeNumber(transaction.receivedAt) ?? now(),
    matchedBankTransactionId: bankTransactionId,
    matchedBy: "MANUAL_REVIEW",
  });
  await updateD1Rows(
    "bankTransactions",
    {
      status: bankTransactionStatus.AUTO_MATCHED,
      matchedPaymentId: paymentId,
    },
    "id = ?",
    [bankTransactionId],
  );

  return await withDomainEvent(
    { result: "Payment matched", status: 200 },
    {
      type: "bankTransaction.confirmed",
      scopes: [venueScope],
      entityType: "bankTransaction",
      entityId: bankTransactionId,
      payload: { paymentId },
    },
  );
}

export async function ignoreBankTransaction(bankTransactionId: string): Promise<MutationResult> {
  await updateD1Rows(
    "bankTransactions",
    { status: bankTransactionStatus.IGNORED },
    "id = ?",
    [bankTransactionId],
  );
  return await withDomainEvent(
    { result: "Bank transaction ignored", status: 200 },
    {
      type: "bankTransaction.ignored",
      scopes: [venueScope],
      entityType: "bankTransaction",
      entityId: bankTransactionId,
    },
  );
}

export async function setMenuOrderStatus(menuOrderId: string, status: string): Promise<MutationResult> {
  const menuOrder = (await queryD1<MenuOrderRow>(
    "SELECT * FROM menuOrders WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [menuOrderId],
  ))[0];

  if (!menuOrder) {
    return { error: "Menu Order Not Found", status: 404 };
  }

  if (status === menuOrderStatus.READY && menuOrder.status !== menuOrderStatus.PENDING) {
    return { error: "Menu order must be pending before ready", status: 409 };
  }

  if (status === menuOrderStatus.PICKED_UP && menuOrder.status !== menuOrderStatus.READY) {
    return { error: "Menu order must be ready before pickup", status: 409 };
  }

  if (status === menuOrderStatus.READY) {
    const paymentJoin = await paymentJoinSql("o", "p");
    const paidOrders = await queryD1<{ paid: boolean | number; status?: string | null; orderStatus?: string | null }>(
      `SELECT p.paid, p.status, o.status AS orderStatus FROM orders o INNER JOIN payments p ON ${paymentJoin} WHERE o.id = ? AND p.deletedAt IS NULL LIMIT 1`,
      [menuOrder.orderId],
    );
    const payment = paidOrders[0];
    const currentPaymentStatus = payment?.status ?? (isPaymentPaid(payment as PaymentRow) ? paymentStatus.PAID : paymentStatus.PENDING);

    if (!payment || payment.orderStatus !== orderStatus.ACTIVE || currentPaymentStatus !== paymentStatus.PAID) {
      return { error: "Order is not paid yet", status: 409 };
    }
  }

  const statusUpdate = await updateD1Rows(
    "menuOrders",
    { status, updatedAt: now() },
    "id = ? AND status = ?",
    [menuOrderId, menuOrder.status],
  );
  if (!statusUpdate || statusUpdate.changed <= 0) {
    return { error: "Menu order status changed", status: 409 };
  }
  const scopeInfo = await getTableIdForMenuOrder(menuOrderId);
  return await withDomainEvent(
    { result: "Success", status: 200 },
    {
      type: status === menuOrderStatus.READY ? "menuOrder.ready" : "menuOrder.pickedUp",
      scopes: [venueScope, ...(scopeInfo?.tableId ? [tableScope(scopeInfo.tableId)] : [])],
      entityType: "menuOrder",
      entityId: menuOrderId,
      payload: { tableId: scopeInfo?.tableId ?? null, orderId: scopeInfo?.orderId ?? menuOrder.orderId, status },
    },
  );
}

export async function markOrderPaid(orderId: string): Promise<MutationResult> {
  const payment = await getPaymentForOrder(orderId);

  if (!payment) {
    return { error: "Payment Not Found", status: 404 };
  }

  const currentPaymentStatus = payment.status ?? (isPaymentPaid(payment) ? paymentStatus.PAID : paymentStatus.PENDING);
  if (
    currentPaymentStatus === paymentStatus.REFUND_PENDING ||
    currentPaymentStatus === paymentStatus.REFUNDED ||
    currentPaymentStatus === paymentStatus.CANCELLED ||
    currentPaymentStatus === paymentStatus.EXPIRED
  ) {
    return { error: "Payment Cannot Be Marked Paid", status: 409 };
  }

  await markPaymentPaidById(payment.id);
  const tableId = await getTableIdForOrder(orderId);
  return await withDomainEvent(
    { result: "Order marked as paid", status: 200 },
    {
      type: "payment.paid",
      scopes: [venueScope, ...(tableId ? [tableScope(tableId)] : [])],
      entityType: "order",
      entityId: orderId,
      payload: { tableId, paymentId: payment.id },
    },
  );
}

export async function completeOrderRefund(
  orderId: string,
  options: { adminUserId?: string | null; refundNote?: string | null } = {},
): Promise<MutationResult> {
  const order = (await queryD1<OrderRow>(
    "SELECT * FROM orders WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [orderId],
  ))[0];

  if (!order) {
    return { error: "Order Not Found", status: 404 };
  }

  const payment = await getPaymentForOrder(orderId);
  if (!payment) {
    return { error: "Payment Not Found", status: 404 };
  }

  if (payment.status !== paymentStatus.REFUND_PENDING) {
    return { error: "Refund is not pending", status: 409 };
  }

  const timestamp = now();
  await updateD1Rows(
    "payments",
    {
      paid: 0,
      status: paymentStatus.REFUNDED,
      refundedAt: timestamp,
      refundHandledByUserId: options.adminUserId ?? null,
      refundNote: options.refundNote?.trim() || null,
      updatedAt: timestamp,
    },
    "id = ?",
    [payment.id],
  );

  const tableId = await getTableIdForOrder(orderId);
  return await withDomainEvent(
    { result: "Order refund completed", status: 200 },
    {
      type: "order.refunded",
      scopes: [venueScope, ...(tableId ? [tableScope(tableId)] : [])],
      entityType: "order",
      entityId: orderId,
      payload: { tableId, paymentId: payment.id },
    },
  );
}

export async function createAdminTable(name: string, seats: number): Promise<MutationResult> {
  const duplicate = (await queryD1<TableRow>(
    "SELECT * FROM tables WHERE name = ? AND deletedAt IS NULL LIMIT 1",
    [name],
  ))[0];

  if (duplicate) {
    return { error: "Table name already exists", status: 409 };
  }

  const tableKeys = await queryD1<{ key: number }>("SELECT key FROM tables WHERE deletedAt IS NULL");
  const usedKeys = new Set(tableKeys.map((row) => row.key));
  const key = Array.from({ length: 100 }, (_, index) => index + 1).find((candidate) => !usedKeys.has(candidate)) ?? 101;
  const timestamp = now();

  const tableId = newId();
  await insertD1Row("tables", {
    id: tableId,
    key,
    name,
    seats,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });

  return await withDomainEvent(
    { result: "Table created", status: 200 },
    {
      type: "table.created",
      scopes: [venueScope],
      entityType: "table",
      entityId: tableId,
    },
  );
}

export async function updateAdminTable(
  tableId: string,
  tableOptions: { name?: string; seats?: number },
): Promise<MutationResult> {
  const table = (await queryD1<TableRow>(
    "SELECT * FROM tables WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [tableId],
  ))[0];

  if (!table) {
    return { error: "Table Not Found", status: 404 };
  }

  await updateD1Rows("tables", { ...tableOptions, updatedAt: now() }, "id = ?", [tableId]);
  return await withDomainEvent(
    { result: "Table updated", status: 200 },
    {
      type: "table.updated",
      scopes: [venueScope, tableScope(tableId)],
      entityType: "table",
      entityId: tableId,
    },
  );
}

export async function removeAdminTable(tableId: string): Promise<MutationResult> {
  const activeContext = await findActiveTableContext(tableId);

  if (activeContext) {
    return { error: "Table is occupied", status: 409 };
  }

  await updateD1Rows("tables", { deletedAt: now(), updatedAt: now() }, "id = ?", [tableId]);
  await revokeTableSessions(tableId);
  return await withDomainEvent(
    { result: "Table removed", status: 200 },
    {
      type: "table.removed",
      scopes: [venueScope, tableScope(tableId)],
      entityType: "table",
      entityId: tableId,
    },
  );
}

export async function occupyAdminTable(tableId: string): Promise<MutationResult> {
  const table = (await queryD1<TableRow>(
    "SELECT * FROM tables WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [tableId],
  ))[0];

  if (!table) {
    return { error: "Table Not Found", status: 404 };
  }

  if (await findActiveTableContext(tableId)) {
    return { error: "Table is already occupied", status: 409 };
  }

  const tableContext = await createTableContext(tableId);
  return await withDomainEvent(
    { result: "Table occupied", status: 200 },
    {
      type: "table.occupied",
      scopes: [venueScope, tableScope(tableId)],
      entityType: "table",
      entityId: tableId,
      payload: { tableContextId: tableContext.id },
    },
  );
}

export async function vacateAdminTable(tableId: string): Promise<MutationResult> {
  const activeContext = await findActiveTableContext(tableId);

  if (!activeContext) {
    return { error: "Table is not occupied yet", status: 409 };
  }

  const pendingMenuOrders = await queryD1<MenuOrderRow>(
    `SELECT mo.* FROM menuOrders mo INNER JOIN orders o ON o.id = mo.orderId WHERE o.tableContextId = ? AND o.deletedAt IS NULL AND mo.deletedAt IS NULL AND mo.status IN (?, ?) LIMIT 1`,
    [activeContext.id, menuOrderStatus.PENDING, menuOrderStatus.READY],
  );

  if (pendingMenuOrders.length > 0) {
    return { error: "There are unfinished orders", status: 409 };
  }

  const paymentJoin = await paymentJoinSql("o", "p");
  const refundPendingOrders = await queryD1<OrderRow>(
    `SELECT o.* FROM orders o INNER JOIN payments p ON ${paymentJoin} WHERE o.tableContextId = ? AND o.deletedAt IS NULL AND p.deletedAt IS NULL AND p.status = ? LIMIT 1`,
    [activeContext.id, paymentStatus.REFUND_PENDING],
  );

  if (refundPendingOrders.length > 0) {
    return { error: "Refund Pending Orders Exist", status: 409 };
  }

  const contextTable = await getTableContextTableName();
  const timestamp = now();
  const values = { deletedAt: timestamp, updatedAt: timestamp };
  await updateD1Rows(contextTable, values, "id = ?", [activeContext.id]);
  await updateLegacyTableContextMirror(contextTable, values, "id = ?", [activeContext.id]);
  await revokeTableSessions(tableId, activeContext.id);
  return await withDomainEvent(
    { result: "Table vacated", status: 200 },
    {
      type: "table.vacated",
      scopes: [venueScope, tableScope(tableId)],
      entityType: "table",
      entityId: tableId,
      payload: { tableContextId: activeContext.id },
    },
  );
}

export async function createAdminMenu(menuOptions: {
  name: string;
  image: string;
  description: string;
  price: number;
  quantity: number;
  menuCategoryId: string;
  available: boolean;
}): Promise<MutationResult> {
  const category = (await queryD1<BaseRow>(
    "SELECT * FROM menuCategories WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [menuOptions.menuCategoryId],
  ))[0];

  if (!category) {
    return { error: "Menu Category Not Found", status: 404 };
  }

  const menuId = newId();
  await insertD1Row("menus", {
    id: menuId,
    ...menuOptions,
    available: menuOptions.available ? 1 : 0,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  });

  return await withDomainEvent(
    { result: "Menu created", status: 201 },
    {
      type: "menu.created",
      scopes: [venueScope],
      entityType: "menu",
      entityId: menuId,
    },
  );
}

export async function updateAdminMenu(
  menuId: string,
  menuOptions: {
    name: string;
    image: string;
    description: string;
    price: number;
    quantity: number;
    menuCategoryId: string;
    available: boolean;
  },
): Promise<MutationResult> {
  await updateD1Rows(
    "menus",
    {
      ...menuOptions,
      available: menuOptions.available ? 1 : 0,
      updatedAt: now(),
    },
    "id = ?",
    [menuId],
  );

  return await withDomainEvent(
    { result: "Menu updated", status: 200 },
    {
      type: "menu.updated",
      scopes: [venueScope],
      entityType: "menu",
      entityId: menuId,
    },
  );
}

export async function removeAdminMenu(menuId: string): Promise<MutationResult> {
  await updateD1Rows("menus", { deletedAt: now(), updatedAt: now() }, "id = ?", [menuId]);
  return await withDomainEvent(
    { result: "Menu deleted successfully", status: 200 },
    {
      type: "menu.removed",
      scopes: [venueScope],
      entityType: "menu",
      entityId: menuId,
    },
  );
}

export async function createAdminMenuCategory(
  menuCategoryOptions: { name: string; description: string },
): Promise<MutationResult> {
  const menuCategoryId = newId();
  await insertD1Row("menuCategories", {
    id: menuCategoryId,
    ...menuCategoryOptions,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  });

  return await withDomainEvent(
    { result: "Menu category created", status: 201 },
    {
      type: "menuCategory.created",
      scopes: [venueScope],
      entityType: "menuCategory",
      entityId: menuCategoryId,
    },
  );
}

export async function updateAdminMenuCategory(
  menuCategoryId: string,
  menuCategoryOptions: { name: string; description: string },
): Promise<MutationResult> {
  await updateD1Rows(
    "menuCategories",
    { ...menuCategoryOptions, updatedAt: now() },
    "id = ?",
    [menuCategoryId],
  );

  return await withDomainEvent(
    { result: "Menu category updated", status: 200 },
    {
      type: "menuCategory.updated",
      scopes: [venueScope],
      entityType: "menuCategory",
      entityId: menuCategoryId,
    },
  );
}

export async function removeAdminMenuCategory(menuCategoryId: string): Promise<MutationResult> {
  await updateD1Rows("menuCategories", { deletedAt: now(), updatedAt: now() }, "id = ?", [menuCategoryId]);
  return await withDomainEvent(
    { result: "Menu category deleted", status: 200 },
    {
      type: "menuCategory.removed",
      scopes: [venueScope],
      entityType: "menuCategory",
      entityId: menuCategoryId,
    },
  );
}
