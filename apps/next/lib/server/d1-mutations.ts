import { generateId } from "lucia";
import { menuOrderStatus } from "db/schema";
import { hasD1Table, queryD1 } from "~/lib/server/db";

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
};

type MenuOrderRow = BaseRow & {
  quantity: number;
  status: string;
  orderId: string;
  menuId: string;
};

type MutationResult = {
  result?: string;
  error?: string;
  status: number;
};

type MenuOrderInput = {
  menuId: string;
  quantity: number;
};

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

  await queryD1(
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
  await queryD1(
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
  return context;
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

export async function createClientOrder(tableId: string, menuOrders: MenuOrderInput[]): Promise<MutationResult> {
  const requestedMenuOrders = aggregateMenuOrders(menuOrders);

  if (requestedMenuOrders.length === 0) {
    return { error: "Invalid request", status: 400 };
  }

  const table = (await queryD1<TableRow>(
    "SELECT * FROM tables WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [tableId],
  ))[0];

  if (!table) {
    return { error: "Table Not Found", status: 409 };
  }

  const tableContext = (await findActiveTableContext(tableId)) ?? (await createTableContext(tableId));
  const paymentJoin = await paymentJoinSql("o", "p");
  const activeOrders = await queryD1<{ id: string; paid: boolean | number | null }>(
    `SELECT o.id, p.paid FROM orders o LEFT JOIN payments p ON ${paymentJoin} AND p.deletedAt IS NULL WHERE o.tableContextId = ? AND o.deletedAt IS NULL`,
    [tableContext.id],
  );

  if (activeOrders.some((order) => order.paid !== true && order.paid !== 1)) {
    return { error: "Unpaid Order Exists", status: 409 };
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
  const orderId = newId();

  for (const menuOrder of requestedMenuOrders) {
    await queryD1(
      "UPDATE menus SET quantity = quantity - ?, updatedAt = ? WHERE id = ?",
      [menuOrder.quantity, timestamp, menuOrder.menuId],
    );
  }

  await insertD1Row("orders", {
    id: orderId,
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

  const paymentHasOrderId = await paymentUsesOrderIdColumn();
  const amount = requestedMenuOrders.reduce((total, menuOrder) => {
    const menu = menusById.get(menuOrder.menuId);
    return total + (menu?.price ?? 0) * menuOrder.quantity;
  }, 0) - table.key;

  await insertD1Row("payments", {
    id: paymentHasOrderId ? newId() : orderId,
    paid: 0,
    amount,
    method: "미결제",
    bank: null,
    depositor: null,
    orderId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });

  return { result: "Order Created", status: 200 };
}

export async function cancelOrder(orderId: string, options: { allowPaid: boolean }): Promise<MutationResult> {
  const order = (await queryD1<BaseRow>(
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

  for (const menuOrder of menuOrders) {
    await queryD1(
      "UPDATE menus SET quantity = quantity + ?, updatedAt = ? WHERE id = ?",
      [menuOrder.quantity, timestamp, menuOrder.menuId],
    );
  }

  await updateD1Rows("menuOrders", { deletedAt: timestamp, updatedAt: timestamp }, "orderId = ?", [orderId]);

  const paymentWhere = await paymentWhereForOrder(orderId);
  await updateD1Rows("payments", { deletedAt: timestamp, updatedAt: timestamp }, paymentWhere.sql, paymentWhere.params);
  await updateD1Rows("orders", { deletedAt: timestamp, updatedAt: timestamp }, "id = ?", [orderId]);

  return { result: "Order Deleted", status: 200 };
}

export async function markDepositPaid(
  amount: number,
  bank: string,
  depositor: string,
  timestamp: number,
): Promise<MutationResult> {
  const payments = await queryD1<PaymentRow>(
    "SELECT * FROM payments WHERE amount = ? AND paid = 0 AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 1",
    [amount],
  );
  const payment = payments[0];

  if (!payment) {
    return { error: "Payment Not Found", status: 400 };
  }

  await updateD1Rows(
    "payments",
    {
      paid: 1,
      bank,
      depositor,
      method: `${bank} ${depositor}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    "id = ?",
    [payment.id],
  );

  return { result: "ok", status: 200 };
}

export async function setMenuOrderStatus(menuOrderId: string, status: string): Promise<MutationResult> {
  const menuOrder = (await queryD1<MenuOrderRow>(
    "SELECT * FROM menuOrders WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [menuOrderId],
  ))[0];

  if (!menuOrder) {
    return { error: "Menu Order Not Found", status: 404 };
  }

  await updateD1Rows("menuOrders", { status, updatedAt: now() }, "id = ?", [menuOrderId]);
  return { result: "Success", status: 200 };
}

export async function markOrderPaid(orderId: string): Promise<MutationResult> {
  const payment = await getPaymentForOrder(orderId);

  if (!payment) {
    return { error: "Payment Not Found", status: 404 };
  }

  const paymentWhere = await paymentWhereForOrder(orderId);
  await updateD1Rows("payments", { paid: 1, updatedAt: now() }, paymentWhere.sql, paymentWhere.params);
  return { result: "Order marked as paid", status: 200 };
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

  await insertD1Row("tables", {
    id: newId(),
    key,
    name,
    seats,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });

  return { result: "Table created", status: 200 };
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
  return { result: "Table updated", status: 200 };
}

export async function removeAdminTable(tableId: string): Promise<MutationResult> {
  const activeContext = await findActiveTableContext(tableId);

  if (activeContext) {
    return { error: "Table is occupied", status: 409 };
  }

  await updateD1Rows("tables", { deletedAt: now(), updatedAt: now() }, "id = ?", [tableId]);
  return { result: "Table removed", status: 200 };
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

  await createTableContext(tableId);
  return { result: "Table occupied", status: 200 };
}

export async function vacateAdminTable(tableId: string): Promise<MutationResult> {
  const activeContext = await findActiveTableContext(tableId);

  if (!activeContext) {
    return { error: "Table is not occupied yet", status: 409 };
  }

  const pendingMenuOrders = await queryD1<MenuOrderRow>(
    `SELECT mo.* FROM menuOrders mo INNER JOIN orders o ON o.id = mo.orderId WHERE o.tableContextId = ? AND o.deletedAt IS NULL AND mo.deletedAt IS NULL AND mo.status = ? LIMIT 1`,
    [activeContext.id, menuOrderStatus.PENDING],
  );

  if (pendingMenuOrders.length > 0) {
    return { error: "There are unfinished orders", status: 409 };
  }

  const contextTable = await getTableContextTableName();
  await updateD1Rows(contextTable, { deletedAt: now(), updatedAt: now() }, "id = ?", [activeContext.id]);
  return { result: "Table vacated", status: 200 };
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

  await insertD1Row("menus", {
    id: newId(),
    ...menuOptions,
    available: menuOptions.available ? 1 : 0,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  });

  return { result: "Menu created", status: 201 };
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

  return { result: "Menu updated", status: 200 };
}

export async function removeAdminMenu(menuId: string): Promise<MutationResult> {
  await updateD1Rows("menus", { deletedAt: now(), updatedAt: now() }, "id = ?", [menuId]);
  return { result: "Menu deleted successfully", status: 200 };
}

export async function createAdminMenuCategory(
  menuCategoryOptions: { name: string; description: string },
): Promise<MutationResult> {
  await insertD1Row("menuCategories", {
    id: newId(),
    ...menuCategoryOptions,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  });

  return { result: "Menu category created", status: 201 };
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

  return { result: "Menu category updated", status: 200 };
}

export async function removeAdminMenuCategory(menuCategoryId: string): Promise<MutationResult> {
  await updateD1Rows("menuCategories", { deletedAt: now(), updatedAt: now() }, "id = ?", [menuCategoryId]);
  return { result: "Menu category deleted", status: 200 };
}
