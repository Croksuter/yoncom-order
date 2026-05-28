export type Bucket = "hour" | "day";

export type MoneyKpi = {
  value: number;
  previousValue: number;
  deltaRate: number | null;
};

export type Summary = {
  grossSales: MoneyKpi;
  netSales: MoneyKpi;
  matchedDeposits: MoneyKpi;
  refundAmount: MoneyKpi;
  estimatedCost: MoneyKpi;
  estimatedProfit: MoneyKpi;
  costRate: number | null;
  orderCount: number;
  soldItemCount: number;
};

export type SeriesPoint = {
  bucketStart: number;
  label: string;
  grossSales: number;
  netSales: number;
  estimatedCost: number;
  estimatedProfit: number;
  orderCount: number;
};

export type PaymentFlow = {
  expectedPayments: number;
  matchedDeposits: number;
  unmatchedDeposits: number;
  refundPendingAmount: number;
  completedRefundAmount: number;
  pendingPaymentCount: number;
  unmatchedDepositCount: number;
};

export type MenuRow = {
  menuId: string;
  menuName: string;
  categoryId: string;
  quantity: number;
  revenue: number;
  appliedUnitCost: number;
  storedUnitCost: number | null;
  estimatedCost: number;
  estimatedProfit: number;
  costRate: number | null;
  currentPrice: number;
  targetMarginBps: number;
  recommendedPrice: number;
  fallbackCostUsed: boolean;
  stockRemaining: number;
};

export type CategoryRow = {
  categoryId: string;
  categoryName: string;
  quantity: number;
  revenue: number;
  estimatedProfit: number;
};

export type Alert = {
  level: "info" | "warning" | "danger";
  title: string;
  description: string;
};

export type Get = {
  result: {
    from: number;
    to: number;
    bucket: Bucket;
    generatedAt: number;
    summary: Summary;
    series: SeriesPoint[];
    paymentFlow: PaymentFlow;
    menuRows: MenuRow[];
    categoryRows: CategoryRow[];
    alerts: Alert[];
  };
};
