import type * as AdminAnalyticsResponse from "shared/types/responses/admin/analytics";

const kstOffsetMs = 9 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const defaultTargetMarginBps = 3500;

export type AnalyticsMenu = {
  id: string;
  name: string;
  price: number;
  unitCost?: number | null;
  targetMarginBps?: number | null;
  quantity: number;
  menuCategoryId: string;
  deletedAt?: number | string | null;
};

export type AnalyticsCategory = {
  id: string;
  name: string;
};

export type AnalyticsMenuBundleItem = {
  bundleMenuId: string;
  componentMenuId: string;
  quantity: number;
};

export type AnalyticsMenuOrder = {
  menuId: string;
  quantity: number;
  deletedAt?: number | string | null;
};

export type AnalyticsPayment = {
  id?: string | null;
  paid?: boolean | number | null;
  status?: string | null;
  amount: number;
  originalAmount?: number | null;
  expectedTransferAmount?: number | null;
  paymentCode?: number | null;
  refundAmount?: number | null;
  refundNote?: string | null;
  paidAt?: number | string | null;
  refundedAt?: number | string | null;
  createdAt?: number | string | null;
  updatedAt?: number | string | null;
  deletedAt?: number | string | null;
};

export type AnalyticsOrder = {
  id: string;
  displayNumber?: number | null;
  status?: string | null;
  cancelReason?: string | null;
  createdAt: number | string;
  updatedAt?: number | string;
  deletedAt?: number | string | null;
  payment: AnalyticsPayment | null;
  menuOrders: AnalyticsMenuOrder[];
};

export type AnalyticsTable = {
  id?: string;
  name?: string;
  tableContexts: Array<{
    id?: string;
    orders: AnalyticsOrder[];
  }>;
};

export type AnalyticsBankTransaction = {
  amount: number;
  status: string;
  receivedAt: number | string;
  matchedPaymentId?: string | null;
};

export type AnalyticsOperatingExpense = AdminAnalyticsResponse.OperatingExpenseRow;

export type BuildAnalyticsInput = {
  from: number;
  to: number;
  bucket: AdminAnalyticsResponse.Bucket;
  tables: AnalyticsTable[];
  categories: AnalyticsCategory[];
  menus: AnalyticsMenu[];
  bundleItems: AnalyticsMenuBundleItem[];
  bankTransactions: AnalyticsBankTransaction[];
  operatingExpenses?: AnalyticsOperatingExpense[];
  targetMarginBps?: number;
  generatedAt?: number;
};

type CountedOrder = {
  order: AnalyticsOrder;
  timestamp: number;
  grossSales: number;
  operatingRevenue: number;
  completedRefundAmount: number;
  refundPendingAmount: number;
  estimatedCost: number;
  estimatedProfit: number;
  itemCount: number;
  isOperatingSale: boolean;
};

export function normalizeTime(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function getFallbackUnitCost(price: number) {
  return Math.floor(Math.max(0, safeNumber(price)) / 3);
}

export function getTargetMarginBps(menu: Pick<AnalyticsMenu, "targetMarginBps">) {
  return safeNumber(menu.targetMarginBps ?? defaultTargetMarginBps, defaultTargetMarginBps);
}

export function getRecommendedPrice(unitCost: number, targetMarginBps = defaultTargetMarginBps) {
  const safeUnitCost = Math.max(0, safeNumber(unitCost));
  const safeTargetMarginBps = safeNumber(targetMarginBps, defaultTargetMarginBps);
  const marginRate = Math.min(Math.max(safeTargetMarginBps, 0), 9500) / 10000;
  const rawPrice = safeUnitCost / Math.max(0.05, 1 - marginRate);
  return Math.ceil(rawPrice / 100) * 100;
}

export function getAppliedUnitCost(
  menu: AnalyticsMenu,
  menusById: Map<string, AnalyticsMenu>,
  bundleItemsByBundleId: Map<string, AnalyticsMenuBundleItem[]>,
): number {
  if (menu.unitCost !== null && menu.unitCost !== undefined) {
    return Math.max(0, safeNumber(menu.unitCost));
  }

  const bundleItems = bundleItemsByBundleId.get(menu.id) ?? [];
  if (bundleItems.length > 0) {
    const componentCost = bundleItems.reduce((sum, item) => {
      const component = menusById.get(item.componentMenuId);
      if (!component) return sum;
      return sum + getAppliedUnitCost(component, menusById, bundleItemsByBundleId) * item.quantity;
    }, 0);
    if (componentCost > 0) return componentCost;
  }

  return getFallbackUnitCost(menu.price);
}

function getKstDayStart(timestamp: number) {
  const kstDate = new Date(timestamp + kstOffsetMs);
  return Date.UTC(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate()) - kstOffsetMs;
}

function getBucketStart(timestamp: number, bucket: AdminAnalyticsResponse.Bucket) {
  if (bucket === "hour") {
    return Math.floor(timestamp / hourMs) * hourMs;
  }

  return getKstDayStart(timestamp);
}

function getBucketLabel(timestamp: number, bucket: AdminAnalyticsResponse.Bucket) {
  const date = new Date(timestamp + kstOffsetMs);
  if (bucket === "hour") {
    return `${String(date.getUTCHours()).padStart(2, "0")}:00`;
  }

  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function getSalesTimestamp(order: AnalyticsOrder) {
  return normalizeTime(order.payment?.paidAt)
    ?? normalizeTime(order.payment?.updatedAt)
    ?? normalizeTime(order.updatedAt)
    ?? normalizeTime(order.createdAt)
    ?? 0;
}

function getOrderMenuTotal(order: AnalyticsOrder, menusById: Map<string, AnalyticsMenu>) {
  return order.menuOrders.reduce((sum, menuOrder) => {
    const menu = menusById.get(menuOrder.menuId);
    return sum + (menu?.price ?? 0) * menuOrder.quantity;
  }, 0);
}

function getOrderAmount(order: AnalyticsOrder, menusById: Map<string, AnalyticsMenu>) {
  const menuTotal = getOrderMenuTotal(order, menusById);
  return order.payment?.originalAmount ?? (menuTotal > 0 ? menuTotal : order.payment?.amount ?? 0);
}

function isCountedPaymentStatus(status: string | null | undefined) {
  return status === "PAID" || status === "REFUND_PENDING" || status === "REFUNDED";
}

function isOperatingSale(order: AnalyticsOrder) {
  return order.status !== "CANCELLED" && (order.payment?.status === "PAID" || order.payment?.status === "REFUND_PENDING");
}

function getOrderCostAndItemCount(
  order: AnalyticsOrder,
  menusById: Map<string, AnalyticsMenu>,
  bundleItemsByBundleId: Map<string, AnalyticsMenuBundleItem[]>,
) {
  return order.menuOrders.reduce((acc, menuOrder) => {
    if (normalizeTime(menuOrder.deletedAt) !== null) return acc;
    const menu = menusById.get(menuOrder.menuId);
    if (!menu) return acc;
    return {
      estimatedCost: acc.estimatedCost + getAppliedUnitCost(menu, menusById, bundleItemsByBundleId) * menuOrder.quantity,
      itemCount: acc.itemCount + menuOrder.quantity,
    };
  }, { estimatedCost: 0, itemCount: 0 });
}

function getComparableRange(from: number, to: number) {
  const duration = to - from;
  return { from: Math.max(0, from - duration), to: from };
}

function deltaRate(value: number, previousValue: number) {
  if (previousValue === 0) return value === 0 ? 0 : null;
  return (value - previousValue) / previousValue;
}

function moneyKpi(value: number, previousValue: number): AdminAnalyticsResponse.MoneyKpi {
  return { value, previousValue, deltaRate: deltaRate(value, previousValue) };
}

function flattenOrders(tables: AnalyticsTable[]) {
  return tables.flatMap((table) =>
    table.tableContexts.flatMap((tableContext) => tableContext.orders),
  );
}

function summarizeOrders(
  orders: AnalyticsOrder[],
  from: number,
  to: number,
  menusById: Map<string, AnalyticsMenu>,
  bundleItemsByBundleId: Map<string, AnalyticsMenuBundleItem[]>,
) {
  return orders
    .filter((order) => {
      const timestamp = getSalesTimestamp(order);
      return (
        normalizeTime(order.deletedAt) === null
        && order.status !== "EXPIRED"
        && order.payment
        && normalizeTime(order.payment.deletedAt) === null
        && isCountedPaymentStatus(order.payment.status)
        && timestamp >= from
        && timestamp < to
      );
    })
    .map((order): CountedOrder => {
      const grossSales = getOrderAmount(order, menusById);
      const operatingSale = isOperatingSale(order);
      const completedRefundAmount = order.payment?.status === "REFUNDED"
        ? order.payment.refundAmount ?? grossSales
        : 0;
      const refundPendingAmount = order.payment?.status === "REFUND_PENDING"
        ? order.payment.refundAmount ?? grossSales
        : 0;
      const { estimatedCost: rawEstimatedCost, itemCount: rawItemCount } = getOrderCostAndItemCount(order, menusById, bundleItemsByBundleId);
      const operatingRevenue = operatingSale ? grossSales : 0;
      const estimatedCost = operatingSale ? rawEstimatedCost : 0;

      return {
        order,
        timestamp: getSalesTimestamp(order),
        grossSales,
        operatingRevenue,
        completedRefundAmount,
        refundPendingAmount,
        estimatedCost,
        estimatedProfit: operatingRevenue - estimatedCost,
        itemCount: operatingSale ? rawItemCount : 0,
        isOperatingSale: operatingSale,
      };
    });
}

function buildRecordRows(
  tables: AnalyticsTable[],
  from: number,
  to: number,
  menusById: Map<string, AnalyticsMenu>,
  bundleItemsByBundleId: Map<string, AnalyticsMenuBundleItem[]>,
): AdminAnalyticsResponse.RecordRow[] {
  const rows: AdminAnalyticsResponse.RecordRow[] = [];

  for (const table of tables) {
    for (const tableContext of table.tableContexts) {
      for (const order of tableContext.orders) {
        const timestamp = getSalesTimestamp(order);
        if (
          normalizeTime(order.deletedAt) !== null
          || timestamp < from
          || timestamp >= to
          || normalizeTime(order.payment?.deletedAt) !== null
        ) {
          continue;
        }

        const grossSales = getOrderAmount(order, menusById);
        const refundAmount = order.payment?.status === "REFUNDED" || order.payment?.status === "REFUND_PENDING"
          ? order.payment.refundAmount ?? grossSales
          : 0;
        const refundReason = refundAmount > 0
          ? order.payment?.refundNote?.trim() || order.cancelReason?.trim() || null
          : null;
        const operatingSale = isOperatingSale(order);
        const { estimatedCost: rawEstimatedCost, itemCount } = getOrderCostAndItemCount(order, menusById, bundleItemsByBundleId);
        const estimatedCost = operatingSale ? rawEstimatedCost : 0;
        const operatingRevenue = operatingSale ? grossSales : 0;
        const completedRefundAmount = order.payment?.status === "REFUNDED" ? refundAmount : 0;
        const paymentAmount = order.payment?.amount ?? 0;

        rows.push({
          recordId: `${order.id}:${order.payment?.id ?? "no-payment"}`,
          orderId: order.id,
          paymentId: order.payment?.id ?? null,
          tableName: table.name ?? "미지정",
          displayNumber: order.displayNumber ?? null,
          orderStatus: order.status ?? null,
          paymentStatus: order.payment?.status ?? null,
          timestamp,
          createdAt: normalizeTime(order.createdAt) ?? timestamp,
          paidAt: normalizeTime(order.payment?.paidAt) ?? null,
          updatedAt: normalizeTime(order.payment?.updatedAt) ?? normalizeTime(order.updatedAt) ?? null,
          grossSales,
          netSales: grossSales - completedRefundAmount,
          refundAmount,
          refundReason,
          estimatedCost,
          estimatedProfit: operatingRevenue - estimatedCost,
          itemCount,
          paymentAmount,
          expectedTransferAmount: order.payment?.expectedTransferAmount ?? null,
          paymentCode: order.payment?.paymentCode ?? null,
        });
      }
    }
  }

  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

export function buildAdminAnalytics(input: BuildAnalyticsInput): AdminAnalyticsResponse.Get["result"] {
  const menus = input.menus.filter((menu) => normalizeTime(menu.deletedAt) === null);
  const menusById = new Map(menus.map((menu) => [menu.id, menu]));
  const categoriesById = new Map(input.categories.map((category) => [category.id, category]));
  const bundleItemsByBundleId = new Map<string, AnalyticsMenuBundleItem[]>();
  for (const item of input.bundleItems) {
    const list = bundleItemsByBundleId.get(item.bundleMenuId) ?? [];
    list.push(item);
    bundleItemsByBundleId.set(item.bundleMenuId, list);
  }

  const allOrders = flattenOrders(input.tables);
  const countedOrders = summarizeOrders(allOrders, input.from, input.to, menusById, bundleItemsByBundleId);
  const previousRange = getComparableRange(input.from, input.to);
  const previousOrders = summarizeOrders(allOrders, previousRange.from, previousRange.to, menusById, bundleItemsByBundleId);

  const sum = (orders: CountedOrder[], key: keyof Pick<CountedOrder, "grossSales" | "completedRefundAmount" | "estimatedCost" | "estimatedProfit">) =>
    orders.reduce((total, row) => total + row[key], 0);

  const grossSales = sum(countedOrders, "grossSales");
  const operatingRevenue = countedOrders.reduce((total, row) => total + row.operatingRevenue, 0);
  const completedRefundAmount = sum(countedOrders, "completedRefundAmount");
  const estimatedCost = sum(countedOrders, "estimatedCost");
  const estimatedProfit = sum(countedOrders, "estimatedProfit");
  const netSales = grossSales - completedRefundAmount;

  const previousGrossSales = sum(previousOrders, "grossSales");
  const previousCompletedRefundAmount = sum(previousOrders, "completedRefundAmount");
  const previousEstimatedCost = sum(previousOrders, "estimatedCost");
  const previousEstimatedProfit = sum(previousOrders, "estimatedProfit");
  const previousNetSales = previousGrossSales - previousCompletedRefundAmount;

  const bucketSeries = new Map<number, AdminAnalyticsResponse.SeriesPoint>();
  for (let cursor = getBucketStart(input.from, input.bucket); cursor < input.to; cursor += input.bucket === "hour" ? hourMs : dayMs) {
    bucketSeries.set(cursor, {
      bucketStart: cursor,
      label: getBucketLabel(cursor, input.bucket),
      grossSales: 0,
      netSales: 0,
      estimatedCost: 0,
      estimatedProfit: 0,
      orderCount: 0,
    });
  }

  const menuRowsById = new Map<string, AdminAnalyticsResponse.MenuRow>();
  const categoryRowsById = new Map<string, Omit<AdminAnalyticsResponse.CategoryRow, "revenueShare">>();

  for (const counted of countedOrders) {
    const bucketStart = getBucketStart(counted.timestamp, input.bucket);
    const point = bucketSeries.get(bucketStart);
    if (point) {
      point.grossSales += counted.grossSales;
      point.netSales += counted.grossSales - counted.completedRefundAmount;
      point.estimatedCost += counted.estimatedCost;
      point.estimatedProfit += counted.estimatedProfit;
      point.orderCount += counted.isOperatingSale ? 1 : 0;
    }

    if (!counted.isOperatingSale) continue;

    for (const menuOrder of counted.order.menuOrders) {
      if (normalizeTime(menuOrder.deletedAt) !== null) continue;
      const menu = menusById.get(menuOrder.menuId);
      if (!menu) continue;
      const appliedUnitCost = getAppliedUnitCost(menu, menusById, bundleItemsByBundleId);
      const targetMarginBps = getTargetMarginBps(menu);
      const revenue = menu.price * menuOrder.quantity;
      const estimatedLineCost = appliedUnitCost * menuOrder.quantity;
      const existing = menuRowsById.get(menu.id) ?? {
        menuId: menu.id,
        menuName: menu.name,
        categoryId: menu.menuCategoryId,
        quantity: 0,
        revenue: 0,
        appliedUnitCost,
        storedUnitCost: menu.unitCost ?? null,
        estimatedCost: 0,
        estimatedProfit: 0,
        costRate: null,
        currentPrice: menu.price,
        targetMarginBps,
        recommendedPrice: getRecommendedPrice(appliedUnitCost, targetMarginBps),
        fallbackCostUsed: menu.unitCost === null || menu.unitCost === undefined,
        stockRemaining: menu.quantity,
      };
      existing.quantity += menuOrder.quantity;
      existing.revenue += revenue;
      existing.estimatedCost += estimatedLineCost;
      existing.estimatedProfit += revenue - estimatedLineCost;
      existing.costRate = existing.revenue > 0 ? existing.estimatedCost / existing.revenue : null;
      menuRowsById.set(menu.id, existing);

      const category = categoriesById.get(menu.menuCategoryId);
      const categoryRow = categoryRowsById.get(menu.menuCategoryId) ?? {
        categoryId: menu.menuCategoryId,
        categoryName: category?.name ?? "미분류",
        quantity: 0,
        revenue: 0,
        estimatedProfit: 0,
      };
      categoryRow.quantity += menuOrder.quantity;
      categoryRow.revenue += revenue;
      categoryRow.estimatedProfit += revenue - estimatedLineCost;
      categoryRowsById.set(menu.menuCategoryId, categoryRow);
    }
  }

  const transactionInRange = input.bankTransactions.filter((transaction) => {
    const receivedAt = normalizeTime(transaction.receivedAt) ?? 0;
    return receivedAt >= input.from && receivedAt < input.to;
  });
  const previousTransactions = input.bankTransactions.filter((transaction) => {
    const receivedAt = normalizeTime(transaction.receivedAt) ?? 0;
    return receivedAt >= previousRange.from && receivedAt < previousRange.to;
  });

  const matchedDeposits = transactionInRange
    .filter((transaction) => transaction.status === "AUTO_MATCHED")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const previousMatchedDeposits = previousTransactions
    .filter((transaction) => transaction.status === "AUTO_MATCHED")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const unmatchedDeposits = transactionInRange
    .filter((transaction) => transaction.status === "UNMATCHED" || transaction.status === "NEEDS_REVIEW")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const refundPendingAmount = countedOrders.reduce((total, order) => total + order.refundPendingAmount, 0);
  const pendingPaymentOrders = allOrders.filter((order) => {
    const timestamp = getSalesTimestamp(order);
    return timestamp >= input.from
      && timestamp < input.to
      && normalizeTime(order.deletedAt) === null
      && (order.payment?.status === "PENDING" || order.payment?.status === "MANUAL_REVIEW");
  });
  const expectedPayments = pendingPaymentOrders.reduce(
    (total, order) => total + (order.payment?.expectedTransferAmount ?? order.payment?.amount ?? 0),
    0,
  );

  const menuRows = [...menuRowsById.values()].sort((a, b) => b.revenue - a.revenue);
  const categoryRevenueTotal = [...categoryRowsById.values()].reduce((total, row) => total + row.revenue, 0);
  const categoryRows = [...categoryRowsById.values()]
    .map((row) => ({
      ...row,
      revenueShare: categoryRevenueTotal > 0 ? row.revenue / categoryRevenueTotal : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const recordRows = buildRecordRows(input.tables, input.from, input.to, menusById, bundleItemsByBundleId);
  const fallbackCostCount = menus.filter((menu) => menu.unitCost === null || menu.unitCost === undefined).length;
  const highSalesFallback = menuRows.find((row) => row.fallbackCostUsed && row.quantity >= 3);
  const lowMarginMenu = menuRows.find((row) => row.costRate !== null && row.costRate > 0.5 && row.quantity > 0);

  const alerts: AdminAnalyticsResponse.Alert[] = [];
  if (fallbackCostCount > 0) {
    alerts.push({
      level: "warning",
      title: "원가 자동 추정 사용 중",
      description: `${fallbackCostCount}개 메뉴는 정가/3 fallback으로 원가를 계산합니다.`,
    });
  }
  if (highSalesFallback) {
    alerts.push({
      level: "warning",
      title: "고판매 메뉴 원가 확인 필요",
      description: `${highSalesFallback.menuName}은 판매량이 높지만 수동 원가가 없습니다.`,
    });
  }
  if (lowMarginMenu) {
    alerts.push({
      level: "danger",
      title: "원가율 높은 메뉴",
      description: `${lowMarginMenu.menuName}의 원가율이 ${Math.round((lowMarginMenu.costRate ?? 0) * 100)}%입니다.`,
    });
  }
  const unmatchedDepositCount = transactionInRange.filter((transaction) => transaction.status === "UNMATCHED" || transaction.status === "NEEDS_REVIEW").length;
  if (unmatchedDepositCount > 0) {
    alerts.push({
      level: "danger",
      title: "미매칭 입금 확인",
      description: `${unmatchedDepositCount}건의 입금이 주문과 아직 연결되지 않았습니다.`,
    });
  }
  if (refundPendingAmount > 0) {
    alerts.push({
      level: "warning",
      title: "환불 대기 금액",
      description: `환불 대기 ${refundPendingAmount.toLocaleString()}원이 정산 전 확인 대상입니다.`,
    });
  }

  return {
    from: input.from,
    to: input.to,
    bucket: input.bucket,
    generatedAt: input.generatedAt ?? Date.now(),
    summary: {
      grossSales: moneyKpi(grossSales, previousGrossSales),
      netSales: moneyKpi(netSales, previousNetSales),
      matchedDeposits: moneyKpi(matchedDeposits, previousMatchedDeposits),
      refundAmount: moneyKpi(completedRefundAmount, previousCompletedRefundAmount),
      estimatedCost: moneyKpi(estimatedCost, previousEstimatedCost),
      estimatedProfit: moneyKpi(estimatedProfit, previousEstimatedProfit),
      costRate: operatingRevenue > 0 ? estimatedCost / operatingRevenue : null,
      orderCount: countedOrders.filter((order) => order.isOperatingSale).length,
      soldItemCount: countedOrders.reduce((total, order) => total + order.itemCount, 0),
    },
    series: [...bucketSeries.values()],
    paymentFlow: {
      expectedPayments,
      matchedDeposits,
      unmatchedDeposits,
      refundPendingAmount,
      completedRefundAmount,
      pendingPaymentCount: pendingPaymentOrders.length,
      unmatchedDepositCount,
    },
    menuRows,
    categoryRows,
    recordRows,
    operatingExpenses: input.operatingExpenses ?? [],
    targetMarginBps: input.targetMarginBps ?? defaultTargetMarginBps,
    alerts,
  };
}
