import { queryD1, hasD1Table } from "~/lib/server/db";

type BaseRow = {
  id: string;
  createdAt: number | string;
  updatedAt: number | string;
  deletedAt: number | string | null;
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
};

type PaymentRow = BaseRow & {
  paid: boolean | number;
  amount: number;
  bank: string | null;
  depositor: string | null;
  orderId: string | null;
};

type MenuOrderRow = BaseRow & {
  quantity: number;
  status: string;
  orderId: string;
  menuId: string;
};

type OrderWithRelations = ReturnType<typeof normalizeOrder> & {
  payment: ReturnType<typeof normalizePayment> | null;
  menuOrders: ReturnType<typeof normalizeMenuOrder>[];
};

type TableContextWithRelations = ReturnType<typeof normalizeTableContext> & {
  orders: OrderWithRelations[];
};

export type TableWithRelations = ReturnType<typeof normalizeTable> & {
  tableContexts: TableContextWithRelations[];
};

let tableContextTableName: string | null = null;

async function getTableContextTableName() {
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

function normalizeTime(value: number | string | null) {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBase<T extends BaseRow>(row: T) {
  return {
    ...row,
    createdAt: normalizeTime(row.createdAt) ?? 0,
    updatedAt: normalizeTime(row.updatedAt) ?? 0,
    deletedAt: normalizeTime(row.deletedAt),
  };
}

function normalizeTable(row: TableRow) {
  return normalizeBase(row);
}

function normalizeTableContext(row: TableContextRow) {
  return normalizeBase(row);
}

function normalizeOrder(row: OrderRow) {
  return normalizeBase(row);
}

function normalizePayment(row: PaymentRow) {
  return {
    ...normalizeBase(row),
    paid: row.paid === true || row.paid === 1,
  };
}

function normalizeMenuOrder(row: MenuOrderRow) {
  return normalizeBase(row);
}

export async function getTablesWithRelations(tableId?: string) {
  const contextTable = await getTableContextTableName();
  const tableRows = tableId
    ? await queryD1<TableRow>("SELECT * FROM tables WHERE id = ?", [tableId])
    : await queryD1<TableRow>("SELECT * FROM tables");

  if (tableRows.length === 0) {
    return [];
  }

  const contexts = await queryD1<TableContextRow>(`SELECT * FROM ${contextTable}`);
  const orders = await queryD1<OrderRow>("SELECT * FROM orders");
  const payments = await queryD1<PaymentRow>("SELECT * FROM payments");
  const menuOrders = await queryD1<MenuOrderRow>("SELECT * FROM menuOrders");

  const paymentsByOrderId = new Map(
    payments.map((payment) => [payment.orderId, normalizePayment(payment)]),
  );

  const menuOrdersByOrderId = new Map<string, ReturnType<typeof normalizeMenuOrder>[]>();
  for (const menuOrder of menuOrders) {
    const normalized = normalizeMenuOrder(menuOrder);
    const list = menuOrdersByOrderId.get(menuOrder.orderId) ?? [];
    list.push(normalized);
    menuOrdersByOrderId.set(menuOrder.orderId, list);
  }

  const ordersByContextId = new Map<string, OrderWithRelations[]>();
  for (const order of orders) {
    const normalized = {
      ...normalizeOrder(order),
      payment: paymentsByOrderId.get(order.id) ?? null,
      menuOrders: menuOrdersByOrderId.get(order.id) ?? [],
    };
    const list = ordersByContextId.get(order.tableContextId) ?? [];
    list.push(normalized);
    ordersByContextId.set(order.tableContextId, list);
  }

  const contextsByTableId = new Map<string, TableContextWithRelations[]>();
  for (const context of contexts) {
    const normalized = {
      ...normalizeTableContext(context),
      orders: ordersByContextId.get(context.id) ?? [],
    };
    const list = contextsByTableId.get(context.tableId) ?? [];
    list.push(normalized);
    contextsByTableId.set(context.tableId, list);
  }

  return tableRows.map((table) => ({
    ...normalizeTable(table),
    tableContexts: contextsByTableId.get(table.id) ?? [],
  }));
}
