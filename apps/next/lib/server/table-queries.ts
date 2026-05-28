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
  isTakeout?: boolean | number | null;
  takeoutFirstOrderRuleEnabled?: boolean | number | null;
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

type PaymentRow = BaseRow & {
  paid: boolean | number;
  amount: number;
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
  bank?: string | null;
  depositor?: string | null;
  method?: string | null;
  orderId?: string | null;
};

type MenuOrderRow = BaseRow & {
  quantity: number;
  status: string;
  orderId: string;
  menuId: string;
};

type MenuRow = BaseRow & {
  name: string;
  price: number;
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
  return {
    ...normalizeBase(row),
    isTakeout: row.isTakeout === true || row.isTakeout === 1,
    takeoutFirstOrderRuleEnabled: row.takeoutFirstOrderRuleEnabled !== false && row.takeoutFirstOrderRuleEnabled !== 0,
  };
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
    status: row.status ?? (row.paid === true || row.paid === 1 ? "PAID" : "PENDING"),
    originalAmount: row.originalAmount ?? row.amount,
    expectedTransferAmount: row.expectedTransferAmount ?? row.amount,
    expiresAt: normalizeTime(row.expiresAt ?? null),
    paidAt: normalizeTime(row.paidAt ?? null),
    refundRequestedAt: normalizeTime(row.refundRequestedAt ?? null),
    refundedAt: normalizeTime(row.refundedAt ?? null),
  };
}

function normalizeMenuOrder(row: MenuOrderRow) {
  return {
    ...normalizeBase(row),
    status: row.status === "SERVED" ? "PICKED_UP" : row.status,
  };
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
    payments.map((payment) => [payment.orderId ?? payment.id, normalizePayment(payment)]),
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

export async function getAuthorizedClientTable(tableId: string, tableContextId: string) {
  const table = (await getTablesWithRelations(tableId))[0];
  if (!table) return null;

  return {
    ...table,
    tableContexts: table.tableContexts.filter((context) => context.id === tableContextId),
  };
}

export async function getCustomerOrderResponse(tableId: string, orderId?: string) {
  const table = (await getTablesWithRelations(tableId))[0];

  if (!table) {
    return null;
  }

  const activeContext = table.tableContexts.find((context) => context.deletedAt === null) ?? null;
  if (!activeContext) {
    return {
      tableId: table.id,
      tableName: table.name,
      tableContextId: null,
      orders: [],
    };
  }

  const menus = await queryD1<MenuRow>("SELECT * FROM menus");
  const menusById = new Map(menus.map((menu) => [menu.id, menu]));
  const sourceOrders = orderId
    ? activeContext.orders.filter((order) => order.id === orderId)
    : activeContext.orders;

  return {
    tableId: table.id,
    tableName: table.name,
    tableContextId: activeContext.id,
    orders: sourceOrders.map((order) => ({
      id: order.id,
      displayNumber: order.displayNumber ?? null,
      status: order.status ?? "ACTIVE",
      createdAt: order.createdAt,
      expiresAt: normalizeTime(order.expiresAt ?? null),
      cancelReason: order.cancelReason ?? null,
      cancelledAt: normalizeTime(order.cancelledAt ?? null),
      payment: {
        id: order.payment?.id ?? "",
        status: order.payment?.status ?? "PENDING",
        paid: order.payment?.paid ?? false,
        originalAmount: order.payment?.originalAmount ?? order.payment?.amount ?? 0,
        expectedTransferAmount: order.payment?.expectedTransferAmount ?? order.payment?.amount ?? 0,
        paymentCode: order.payment?.paymentCode ?? null,
        expiresAt: order.payment?.expiresAt ?? null,
        paidAt: order.payment?.paidAt ?? null,
        refundAmount: order.payment?.refundAmount ?? null,
        refundRequestedAt: order.payment?.refundRequestedAt ?? null,
        refundedAt: order.payment?.refundedAt ?? null,
      },
      menuOrders: order.menuOrders.map((menuOrder) => {
        const menu = menusById.get(menuOrder.menuId);
        return {
          id: menuOrder.id,
          menuId: menuOrder.menuId,
          menuName: menu?.name ?? "알 수 없는 메뉴",
          price: menu?.price ?? 0,
          quantity: menuOrder.quantity,
          status: menuOrder.status,
        };
      }),
    })),
  };
}
