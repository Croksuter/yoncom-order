"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import type * as AdminAnalyticsResponse from "shared/types/responses/admin/analytics";
import { api } from "~/lib/query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertTriangle,
  Banknote,
  Download,
  LineChart,
  PackageSearch,
  Plus,
  ReceiptText,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";

const kstOffsetMs = 9 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const rangeStorageKey = "yoncom-order.admin.analytics.range";
const defaultTargetMarginPercent = "35";
const defaultTargetMarginBps = 3500;
const presetOptions = [
  { id: "today", label: "오늘" },
  { id: "7d", label: "7일" },
  { id: "30d", label: "30일" },
  { id: "custom", label: "사용자 지정" },
] as const;

type Preset = (typeof presetOptions)[number]["id"];
type ExpenseRow = {
  id: string;
  label: string;
  amount: string;
};

type RangeValue = {
  from: number;
  to: number;
};

type SortDirection = "asc" | "desc";
type MenuSortKey =
  | "menuName"
  | "quantity"
  | "revenue"
  | "appliedUnitCost"
  | "estimatedProfit"
  | "costRate"
  | "currentPrice"
  | "recommendedPrice";
type MenuProfitabilityRow = AdminAnalyticsResponse.MenuRow & {
  recommendedRevenue: number;
  recommendedProfit: number;
  priceGap: number;
};

const defaultExpenseRows: ExpenseRow[] = [
  { id: "expense-booth", label: "부스 대여료", amount: "" },
  { id: "expense-supplies", label: "소모품/장비", amount: "" },
];

function newExpenseId() {
  return `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function startOfKstDay(timestamp = Date.now()) {
  const kstDate = new Date(timestamp + kstOffsetMs);
  return Date.UTC(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate()) - kstOffsetMs;
}

function toDateTimeInputValue(timestamp: number) {
  const date = new Date(timestamp + kstOffsetMs);
  return [
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
    `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`,
  ].join("T");
}

function fromDateTimeInputValue(value: string) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0] = timePart.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute) - kstOffsetMs;
}

function formatKstDateTime(timestamp: number | null) {
  if (timestamp === null || !Number.isFinite(timestamp)) return "-";
  return toDateTimeInputValue(timestamp).replace("T", " ");
}

function toFileDateTime(timestamp: number) {
  return toDateTimeInputValue(timestamp).replaceAll("-", "").replaceAll(":", "").replaceAll("T", "");
}

function getPresetRange(preset: Preset) {
  const todayStart = startOfKstDay();
  if (preset === "today") return { from: todayStart, to: todayStart + dayMs };
  if (preset === "7d") return { from: todayStart - 6 * dayMs, to: todayStart + dayMs };
  if (preset === "30d") return { from: todayStart - 29 * dayMs, to: todayStart + dayMs };
  return { from: todayStart, to: todayStart + dayMs };
}

function isPreset(value: unknown): value is Preset {
  return presetOptions.some((option) => option.id === value);
}

function readStoredRangePreference(): { preset: Preset; range: RangeValue } | null {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(rangeStorageKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as { preset?: unknown; from?: unknown; to?: unknown };
    const storedPreset = isPreset(parsed.preset) ? parsed.preset : "custom";
    if (storedPreset !== "custom") {
      return { preset: storedPreset, range: getPresetRange(storedPreset) };
    }

    const from = Number(parsed.from);
    const to = Number(parsed.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
    return { preset: "custom", range: { from, to } };
  } catch {
    return null;
  }
}

function writeStoredRangePreference(preset: Preset, range: RangeValue) {
  if (typeof window === "undefined") return;

  try {
    const payload = preset === "custom"
      ? { preset, from: range.from, to: range.to }
      : { preset };
    window.localStorage.setItem(rangeStorageKey, JSON.stringify(payload));
  } catch {
    // Ignore storage failures; analytics should still work without persistence.
  }
}

function formatWon(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `₩${Math.round(safeValue).toLocaleString()}`;
}

function formatSignedWon(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue >= 0 ? "+" : "-";
  return `${sign}${formatWon(Math.abs(safeValue))}`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function targetMarginBpsFromPercent(value: string) {
  const parsed = Number(value);
  const bps = Number.isFinite(parsed) ? Math.round(parsed * 100) : defaultTargetMarginBps;
  return Math.min(Math.max(bps, 0), 9500);
}

function formatTargetMarginPercent(targetMarginBps: number) {
  return `${Math.round(targetMarginBps) / 100}%`;
}

function recommendedPrice(unitCost: number, targetMarginBps: number) {
  const safeUnitCost = Math.max(0, Number.isFinite(unitCost) ? unitCost : 0);
  const safeTargetMarginBps = Math.min(Math.max(Number.isFinite(targetMarginBps) ? targetMarginBps : defaultTargetMarginBps, 0), 9500);
  const marginRate = safeTargetMarginBps / 10000;
  return Math.ceil((safeUnitCost / Math.max(0.05, 1 - marginRate)) / 100) * 100;
}

function parseExpenseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeSearchText(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("ko-KR");
}

function getMenuSortValue(row: MenuProfitabilityRow, key: MenuSortKey) {
  if (key === "menuName") return row.menuName;
  if (key === "quantity") return row.quantity;
  if (key === "revenue") return row.revenue;
  if (key === "appliedUnitCost") return row.appliedUnitCost;
  if (key === "estimatedProfit") return row.estimatedProfit;
  if (key === "costRate") return row.costRate;
  if (key === "currentPrice") return row.currentPrice;
  return row.recommendedPrice;
}

function compareMenuRows(a: MenuProfitabilityRow, b: MenuProfitabilityRow, key: MenuSortKey, direction: SortDirection) {
  const leftValue = getMenuSortValue(a, key);
  const rightValue = getMenuSortValue(b, key);
  const directionFactor = direction === "asc" ? 1 : -1;

  if (typeof leftValue === "string" || typeof rightValue === "string") {
    return normalizeSearchText(leftValue).localeCompare(normalizeSearchText(rightValue), "ko-KR") * directionFactor;
  }

  const leftNumber = leftValue ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  const rightNumber = rightValue ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  if (leftNumber === rightNumber) return a.menuName.localeCompare(b.menuName, "ko-KR");
  return (leftNumber - rightNumber) * directionFactor;
}

function recordMatchesSearch(row: AdminAnalyticsResponse.RecordRow, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return [
    formatKstDateTime(row.timestamp),
    row.tableName,
    row.displayNumber,
    row.orderId,
    row.paymentId,
    row.orderStatus,
    row.paymentStatus,
    row.refundReason,
    row.grossSales,
    row.netSales,
    row.refundAmount,
    row.estimatedCost,
    row.estimatedProfit,
    row.itemCount,
    row.paymentAmount,
    row.expectedTransferAmount,
    row.paymentCode,
  ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

function csvValue(value: string | number | null) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

function csvContent(header: string[], rows: Array<Array<string | number | null>>) {
  return [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
}

function downloadCsvFile(filename: string, header: string[], rows: Array<Array<string | number | null>>) {
  const blob = new Blob([csvContent(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDelta(deltaRate: number | null) {
  if (deltaRate === null) return "신규";
  if (deltaRate === 0) return "변동 없음";
  return `${deltaRate > 0 ? "+" : ""}${Math.round(deltaRate * 100)}%`;
}

function kpiTone(deltaRate: number | null) {
  if (deltaRate === null || deltaRate === 0) return "text-slate-400 dark:text-slate-300";
  return deltaRate > 0 ? "text-emerald-500" : "text-rose-500";
}

function KpiCard({
  label,
  value,
  helper,
  helperClass = "text-slate-400 dark:text-slate-300",
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  helperClass?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-3 shadow-sm">
      <Icon className="absolute right-3 top-3 h-3.5 w-3.5 text-brand-500/60 dark:text-brand-300/70" />
      <div className="min-w-0 pr-5">
        <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-300">{label}</p>
        <p className="mt-2 truncate text-xl font-black text-slate-850 dark:text-white">{value}</p>
        <p className={`mt-1 truncate text-xs font-bold ${helperClass}`}>{helper}</p>
      </div>
    </div>
  );
}

function RevenueChart({ series }: { series: AdminAnalyticsResponse.SeriesPoint[] }) {
  const maxSales = Math.max(1, ...series.map((point) => point.grossSales));
  const maxProfit = Math.max(1, ...series.map((point) => Math.max(0, point.estimatedProfit)));
  const width = 720;
  const height = 240;
  const chartTop = 20;
  const chartBottom = 194;
  const chartHeight = chartBottom - chartTop;
  const step = series.length > 1 ? width / series.length : width;
  const linePoints = series.map((point, index) => {
    const x = index * step + step / 2;
    const y = chartBottom - (Math.max(0, point.estimatedProfit) / maxProfit) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-850 dark:text-white">매출 추이</h3>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-300">막대는 매출, 선은 추정 이윤</p>
        </div>
        <LineChart className="h-5 w-5 text-brand-500" />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-950/50 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="매출 추이 차트">
          {[0, 1, 2, 3].map((line) => {
            const y = chartTop + (chartHeight / 3) * line;
            return <line key={line} x1="0" x2={width} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="4 6" />;
          })}
          {series.map((point, index) => {
            const barWidth = Math.max(12, step * 0.48);
            const barHeight = (point.grossSales / maxSales) * chartHeight;
            const x = index * step + (step - barWidth) / 2;
            const y = chartBottom - barHeight;
            return (
              <g key={point.bucketStart}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" className="fill-brand-500/80 dark:fill-brand-400/80" />
                {(series.length <= 12 || index % Math.ceil(series.length / 8) === 0) && (
                  <text x={index * step + step / 2} y="226" textAnchor="middle" className="fill-slate-400 text-[11px] font-bold">
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}
          <polyline points={linePoints} fill="none" className="stroke-emerald-500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState(getPresetRange("today"));
  const [isRangeHydrated, setIsRangeHydrated] = useState(false);
  const [targetMarginPercent, setTargetMarginPercent] = useState(defaultTargetMarginPercent);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(defaultExpenseRows);
  const [menuSort, setMenuSort] = useState<{ key: MenuSortKey; direction: SortDirection }>({ key: "revenue", direction: "desc" });
  const [recordSearchQuery, setRecordSearchQuery] = useState("");
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [data, setData] = useState<AdminAnalyticsResponse.Get["result"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingRecords, setIsDeletingRecords] = useState(false);
  const [error, setError] = useState(false);
  const bucket = range.to - range.from <= 2 * dayMs ? "hour" : "day";
  const targetMarginBps = useMemo(() => targetMarginBpsFromPercent(targetMarginPercent), [targetMarginPercent]);
  const targetMarginLabel = formatTargetMarginPercent(targetMarginBps);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const response = await api.get("admin/analytics", {
        searchParams: {
          from: range.from,
          to: range.to,
          bucket,
        },
      }).json<AdminAnalyticsResponse.Get>();
      setData(response.result);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [bucket, range.from, range.to]);

  useEffect(() => {
    const storedPreference = readStoredRangePreference();
    if (storedPreference) {
      setPreset(storedPreference.preset);
      setRange(storedPreference.range);
    }
    setIsRangeHydrated(true);
  }, []);

  useEffect(() => {
    if (!isRangeHydrated) return;
    writeStoredRangePreference(preset, range);
  }, [isRangeHydrated, preset, range]);

  useEffect(() => {
    if (!isRangeHydrated) return;
    void loadAnalytics();
  }, [isRangeHydrated, loadAnalytics]);

  useEffect(() => {
    setSelectedRecordIds(new Set());
  }, [data?.from, data?.to, data?.generatedAt]);

  const extraExpenseTotal = useMemo(
    () => expenseRows.reduce((sum, row) => sum + parseExpenseAmount(row.amount), 0),
    [expenseRows],
  );
  const adjustedFinancials = useMemo(() => {
    const grossSales = data?.summary.grossSales.value ?? 0;
    const operatingRevenue = data?.menuRows.reduce((sum, row) => sum + row.revenue, 0) ?? 0;
    const estimatedCost = data?.summary.estimatedCost.value ?? 0;
    const estimatedProfit = data?.summary.estimatedProfit.value ?? 0;
    const adjustedCost = estimatedCost + extraExpenseTotal;
    return {
      grossSales,
      operatingRevenue,
      estimatedCost,
      adjustedCost,
      adjustedProfit: estimatedProfit - extraExpenseTotal,
      adjustedCostRate: operatingRevenue > 0 ? adjustedCost / operatingRevenue : null,
    };
  }, [data, extraExpenseTotal]);

  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "매출",
        value: formatWon(data.summary.grossSales.value),
        helper: formatDelta(data.summary.grossSales.deltaRate),
        helperClass: kpiTone(data.summary.grossSales.deltaRate),
        icon: TrendingUp,
      },
      {
        label: "순입금",
        value: formatWon(data.summary.matchedDeposits.value),
        helper: formatDelta(data.summary.matchedDeposits.deltaRate),
        helperClass: kpiTone(data.summary.matchedDeposits.deltaRate),
        icon: Banknote,
      },
      {
        label: "환불/취소",
        value: formatWon(data.summary.refundAmount.value),
        helper: `${data.paymentFlow.refundPendingAmount.toLocaleString()}원 대기`,
        helperClass: "text-rose-500",
        icon: ReceiptText,
      },
      {
        label: "추정 원가",
        value: formatWon(adjustedFinancials.adjustedCost),
        helper: extraExpenseTotal > 0 ? `운영비 ${formatWon(extraExpenseTotal)} 포함` : formatDelta(data.summary.estimatedCost.deltaRate),
        helperClass: extraExpenseTotal > 0 ? "text-amber-500" : kpiTone(data.summary.estimatedCost.deltaRate),
        icon: PackageSearch,
      },
      {
        label: "추정 이윤",
        value: formatWon(adjustedFinancials.adjustedProfit),
        helper: extraExpenseTotal > 0 ? `운영비 차감 ${formatWon(extraExpenseTotal)}` : formatDelta(data.summary.estimatedProfit.deltaRate),
        helperClass: adjustedFinancials.adjustedProfit >= 0 ? "text-emerald-500" : "text-rose-500",
        icon: WalletCards,
      },
      {
        label: "원가율",
        value: formatPercent(adjustedFinancials.adjustedCostRate),
        helper: `${data.summary.soldItemCount.toLocaleString()}개 판매`,
        helperClass: "text-slate-400",
        icon: Scale,
      },
    ];
  }, [adjustedFinancials, data, extraExpenseTotal]);

  const simulatedMenuRows = useMemo(() => {
    if (!data) return [];
    return data.menuRows.map((row): MenuProfitabilityRow => {
      const simulatedRecommendedPrice = recommendedPrice(row.appliedUnitCost, targetMarginBps);
      return {
        ...row,
        recommendedPrice: simulatedRecommendedPrice,
        recommendedRevenue: simulatedRecommendedPrice * row.quantity,
        recommendedProfit: (simulatedRecommendedPrice - row.appliedUnitCost) * row.quantity,
        priceGap: simulatedRecommendedPrice - row.currentPrice,
      };
    });
  }, [data, targetMarginBps]);
  const sortedMenuRows = useMemo(
    () => [...simulatedMenuRows].sort((a, b) => compareMenuRows(a, b, menuSort.key, menuSort.direction)),
    [menuSort.direction, menuSort.key, simulatedMenuRows],
  );

  const pricingSummary = useMemo(() => {
    const currentRevenue = simulatedMenuRows.reduce((sum, row) => sum + row.revenue, 0);
    const currentProfit = simulatedMenuRows.reduce((sum, row) => sum + row.estimatedProfit, 0);
    const recommendedRevenue = simulatedMenuRows.reduce((sum, row) => sum + row.recommendedRevenue, 0);
    const recommendedProfit = simulatedMenuRows.reduce((sum, row) => sum + row.recommendedProfit, 0);
    const adjustedCurrentProfit = currentProfit - extraExpenseTotal;
    const adjustedRecommendedProfit = recommendedProfit - extraExpenseTotal;
    return {
      currentRevenue,
      currentProfit: adjustedCurrentProfit,
      recommendedRevenue,
      recommendedProfit: adjustedRecommendedProfit,
      revenueDelta: recommendedRevenue - currentRevenue,
      profitDelta: adjustedRecommendedProfit - adjustedCurrentProfit,
    };
  }, [extraExpenseTotal, simulatedMenuRows]);

  const selectedRecords = useMemo(() => {
    if (!data) return [];
    return data.recordRows.filter((row) => selectedRecordIds.has(row.recordId));
  }, [data, selectedRecordIds]);
  const filteredRecordRows = useMemo(() => {
    if (!data) return [];
    return data.recordRows.filter((row) => recordMatchesSearch(row, recordSearchQuery));
  }, [data, recordSearchQuery]);
  const selectedVisibleRecordCount = useMemo(
    () => filteredRecordRows.filter((row) => selectedRecordIds.has(row.recordId)).length,
    [filteredRecordRows, selectedRecordIds],
  );

  const toggleMenuSort = (key: MenuSortKey) => {
    setMenuSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "desc" ? "asc" : "desc" };
      }
      return { key, direction: key === "menuName" ? "asc" : "desc" };
    });
  };

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const toggleAllRecords = () => {
    if (filteredRecordRows.length === 0) return;
    setSelectedRecordIds((prev) => {
      const visibleRecordIds = filteredRecordRows.map((row) => row.recordId);
      const next = new Set(prev);
      if (visibleRecordIds.every((recordId) => next.has(recordId))) {
        visibleRecordIds.forEach((recordId) => next.delete(recordId));
        return next;
      }
      visibleRecordIds.forEach((recordId) => next.add(recordId));
      return next;
    });
  };

  const deleteSelectedRecords = async () => {
    if (!data || selectedRecords.length === 0 || isDeletingRecords) return;
    const confirmed = window.confirm(`${selectedRecords.length}개 오더/페이먼트 기록을 삭제 처리할까요?`);
    if (!confirmed) return;

    setIsDeletingRecords(true);
    try {
      await api.delete("admin/analytics", {
        json: {
          orderIds: selectedRecords.map((row) => row.orderId),
          paymentIds: selectedRecords.map((row) => row.paymentId).filter((id): id is string => Boolean(id)),
        },
      }).json<AdminAnalyticsResponse.DeleteRecords>();
      setSelectedRecordIds(new Set());
      await loadAnalytics();
    } finally {
      setIsDeletingRecords(false);
    }
  };

  const exportCsvBundle = () => {
    if (!data) return;
    const suffix = `${toFileDateTime(data.from)}-${toFileDateTime(data.to)}`;

    downloadCsvFile(`sales-summary-${suffix}.csv`, ["항목", "값"], [
      ["조회 시작", formatKstDateTime(data.from)],
      ["조회 종료", formatKstDateTime(data.to)],
      ["매출", data.summary.grossSales.value],
      ["순입금", data.summary.matchedDeposits.value],
      ["환불/취소", data.summary.refundAmount.value],
      ["메뉴 추정 원가", adjustedFinancials.estimatedCost],
      ["운영비", extraExpenseTotal],
      ["운영비 포함 추정 원가", adjustedFinancials.adjustedCost],
      ["운영비 포함 추정 이윤", adjustedFinancials.adjustedProfit],
      ["운영비 포함 원가율", adjustedFinancials.adjustedCostRate === null ? "" : Math.round(adjustedFinancials.adjustedCostRate * 1000) / 10],
      ["목표 마진", targetMarginLabel],
    ]);

    downloadCsvFile(`sales-trend-${suffix}.csv`, ["시작시각", "라벨", "매출", "순매출", "추정원가", "추정이윤", "주문수"], data.series.map((point) => [
      formatKstDateTime(point.bucketStart),
      point.label,
      point.grossSales,
      point.netSales,
      point.estimatedCost,
      point.estimatedProfit,
      point.orderCount,
    ]));

    downloadCsvFile(`sales-menu-profitability-${suffix}.csv`, ["메뉴", "판매수량", "매출", "적용원가", "이윤", "원가율", "현재가", "목표마진", "권장가", "현재가대비"], simulatedMenuRows.map((row) => [
      row.menuName,
      row.quantity,
      row.revenue,
      row.appliedUnitCost,
      row.estimatedProfit,
      row.costRate === null ? "" : Math.round(row.costRate * 1000) / 10,
      row.currentPrice,
      targetMarginLabel,
      row.recommendedPrice,
      row.priceGap,
    ]));

    downloadCsvFile(`sales-category-mix-${suffix}.csv`, ["카테고리", "판매수량", "매출", "매출비중", "추정이윤"], data.categoryRows.map((row) => [
      row.categoryName,
      row.quantity,
      row.revenue,
      Math.round(row.revenueShare * 1000) / 10,
      row.estimatedProfit,
    ]));

    downloadCsvFile(`sales-records-${suffix}.csv`, ["시각", "테이블", "주문번호", "오더ID", "페이먼트ID", "오더상태", "결제상태", "매출", "순매출", "환불", "환불사유", "추정원가", "추정이윤", "상품수", "결제코드"], data.recordRows.map((row) => [
      formatKstDateTime(row.timestamp),
      row.tableName,
      row.displayNumber ?? "",
      row.orderId,
      row.paymentId ?? "",
      row.orderStatus ?? "",
      row.paymentStatus ?? "",
      row.grossSales,
      row.netSales,
      row.refundAmount,
      row.refundReason ?? "",
      row.estimatedCost,
      row.estimatedProfit,
      row.itemCount,
      row.paymentCode ?? "",
    ]));

    downloadCsvFile(`sales-expenses-${suffix}.csv`, ["비용 항목", "금액"], [
      ...expenseRows.map((row) => [row.label, parseExpenseAmount(row.amount)] as [string, number]),
      ["합계", extraExpenseTotal],
    ]);
  };

  const SortIcon = ({ sortKey }: { sortKey: MenuSortKey }) => {
    if (menuSort.key !== sortKey) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
    return menuSort.direction === "asc"
      ? <ArrowUp className="h-3 w-3 text-brand-500" />
      : <ArrowDown className="h-3 w-3 text-brand-500" />;
  };

  const SortHeader = ({ sortKey, label, align = "right" }: { sortKey: MenuSortKey; label: string; align?: "left" | "right" }) => (
    <button
      type="button"
      onClick={() => toggleMenuSort(sortKey)}
      className={`flex w-full items-center gap-1.5 ${align === "right" ? "justify-end" : "justify-start"} rounded-lg text-xs font-black transition-colors hover:text-brand-500`}
      aria-label={`${label} 기준 정렬`}
    >
      <span>{label}</span>
      <SortIcon sortKey={sortKey} />
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 lg:p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {presetOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setPreset(option.id);
                    if (option.id !== "custom") setRange(getPresetRange(option.id));
                  }}
                  className={`h-9 rounded-xl px-4 text-xs font-black transition-all ${
                    preset === option.id
                      ? "bg-brand-500 text-white shadow-sm shadow-brand-500/20"
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={toDateTimeInputValue(range.from)}
                onChange={(event) => {
                  setPreset("custom");
                  setRange((prev) => ({ ...prev, from: fromDateTimeInputValue(event.target.value) }));
                }}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              />
              <input
                type="datetime-local"
                value={toDateTimeInputValue(range.to)}
                onChange={(event) => {
                  setPreset("custom");
                  setRange((prev) => ({ ...prev, to: fromDateTimeInputValue(event.target.value) }));
                }}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              />
              <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <span className="whitespace-nowrap">목표 마진</span>
                <input
                  type="number"
                  value={targetMarginPercent}
                  min={0}
                  max={95}
                  step={1}
                  onChange={(event) => setTargetMarginPercent(event.target.value)}
                  className="h-7 w-14 rounded-lg border border-slate-100 bg-slate-50 px-2 text-right text-xs font-black text-slate-700 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
                <span>%</span>
              </label>
              <button
                type="button"
                onClick={() => void loadAnalytics()}
                className="flex h-9 items-center gap-2 rounded-xl bg-slate-800 px-3 text-xs font-black text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                새로고침
              </button>
              <button
                type="button"
                onClick={exportCsvBundle}
                disabled={!data}
                className="flex h-9 items-center gap-2 rounded-xl bg-emerald-500 px-3 text-xs font-black text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                CSV 묶음
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
            analytics 데이터를 불러오지 못했습니다.
          </div>
        )}

        {!data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {kpis.map((kpi) => (
                <div key={kpi.label}>
                  <KpiCard label={kpi.label} value={kpi.value} helper={kpi.helper} helperClass={kpi.helperClass} icon={kpi.icon} />
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-850 dark:text-white">운영 비용</h3>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-300">부스 대여료, 소모품, 장비 구매처럼 메뉴 원가 밖 비용을 이윤 계산에 반영합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                    합계 {formatWon(extraExpenseTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpenseRows((rows) => [...rows, { id: newExpenseId(), label: "", amount: "" }])}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-800 px-3 text-xs font-black text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    비용 추가
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {expenseRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_120px_32px] items-center gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-950/50">
                    <input
                      value={row.label}
                      onChange={(event) => setExpenseRows((rows) => rows.map((item) => item.id === row.id ? { ...item, label: event.target.value } : item))}
                      placeholder="비용 항목"
                      className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={row.amount}
                      onChange={(event) => setExpenseRows((rows) => rows.map((item) => item.id === row.id ? { ...item, amount: event.target.value } : item))}
                      placeholder="금액"
                      className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-right text-xs font-black text-slate-700 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setExpenseRows((rows) => rows.length <= 1 ? [{ ...rows[0], label: "", amount: "" }] : rows.filter((item) => item.id !== row.id))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/20"
                      title="비용 항목 삭제"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-300">목표 마진</p>
                <p className="mt-2 text-xl font-black text-slate-850 dark:text-white">{targetMarginLabel}</p>
                <p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-300">전역 권장가 기준</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-300">권장가 기준 매출</p>
                <p className="mt-2 text-xl font-black text-slate-850 dark:text-white">{formatWon(pricingSummary.recommendedRevenue)}</p>
                <p className={`mt-1 text-xs font-bold ${pricingSummary.revenueDelta >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  현재가 대비 {formatSignedWon(pricingSummary.revenueDelta)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-300">권장가 기준 이윤</p>
                <p className="mt-2 text-xl font-black text-slate-850 dark:text-white">{formatWon(pricingSummary.recommendedProfit)}</p>
                <p className={`mt-1 text-xs font-bold ${pricingSummary.profitDelta >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  현재가 대비 {formatSignedWon(pricingSummary.profitDelta)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-8">
                <RevenueChart series={data.series} />
              </div>
              <div className="xl:col-span-4">
                <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-850 dark:text-white">자금 흐름</h3>
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-300">입금 매칭과 환불 대기</p>
                    </div>
                    <Banknote className="h-5 w-5 text-brand-500" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      ["입금 예상", data.paymentFlow.expectedPayments],
                      ["매칭 입금", data.paymentFlow.matchedDeposits],
                      ["미매칭 입금", data.paymentFlow.unmatchedDeposits],
                      ["환불 대기", data.paymentFlow.refundPendingAmount],
                      ["환불 완료", data.paymentFlow.completedRefundAmount],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-950/50">
                        <span className="text-xs font-black text-slate-400 dark:text-slate-300">{label}</span>
                        <span className="text-sm font-black text-slate-850 dark:text-white">{formatWon(Number(value))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-8">
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-black text-slate-850 dark:text-white">메뉴별 수익성</h3>
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-300">원가 미입력 메뉴는 정가/3 기준, 권장가는 목표 마진 {targetMarginLabel} 기준</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-black text-slate-400 dark:bg-slate-800/40 dark:text-slate-300">
                          <th className="px-4 py-3"><SortHeader sortKey="menuName" label="메뉴" align="left" /></th>
                          <th className="px-4 py-3 text-right"><SortHeader sortKey="quantity" label="판매수량" /></th>
                          <th className="px-4 py-3 text-right"><SortHeader sortKey="revenue" label="매출" /></th>
                          <th className="px-4 py-3 text-right"><SortHeader sortKey="appliedUnitCost" label="적용 원가" /></th>
                          <th className="px-4 py-3 text-right"><SortHeader sortKey="estimatedProfit" label="이윤" /></th>
                          <th className="px-4 py-3 text-right"><SortHeader sortKey="costRate" label="원가율" /></th>
                          <th className="px-4 py-3 text-right"><SortHeader sortKey="currentPrice" label="현재가" /></th>
                          <th className="px-4 py-3 text-right"><SortHeader sortKey="recommendedPrice" label="권장가" /></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {sortedMenuRows.slice(0, 12).map((row) => (
                          <tr key={row.menuId} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{row.menuName}</span>
                                {row.fallbackCostUsed && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
                                    자동원가
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-200">{row.quantity}</td>
                            <td className="px-4 py-3 text-right text-sm font-black text-slate-850 dark:text-white">{formatWon(row.revenue)}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-200">{formatWon(row.appliedUnitCost)}</td>
                            <td className="px-4 py-3 text-right text-sm font-black text-emerald-600 dark:text-emerald-400">{formatWon(row.estimatedProfit)}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-200">{formatPercent(row.costRate)}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-200">{formatWon(row.currentPrice)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="text-sm font-black text-brand-600 dark:text-brand-300">{formatWon(row.recommendedPrice)}</div>
                              <div className={`text-[11px] font-black ${row.priceGap >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatSignedWon(row.priceGap)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {simulatedMenuRows.length === 0 && (
                    <div className="p-8 text-center text-sm font-bold text-slate-400">선택한 기간의 판매 데이터가 없습니다.</div>
                  )}
                </div>
              </div>
              <div className="space-y-4 xl:col-span-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                  <h3 className="text-base font-black text-slate-850 dark:text-white">카테고리 믹스</h3>
                  <div className="mt-4 space-y-3">
                    {data.categoryRows.slice(0, 6).map((row) => {
                      const maxRevenue = Math.max(1, ...data.categoryRows.map((category) => category.revenue));
                      return (
                        <div key={row.categoryId}>
                          <div className="mb-1 flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-600 dark:text-slate-200">{row.categoryName}</span>
                            <span className="text-slate-400">{formatWon(row.revenue)} · {formatPercent(row.revenueShare)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, (row.revenue / maxRevenue) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-base font-black text-slate-850 dark:text-white">운영 알림</h3>
                  </div>
                  <div className="mt-3 space-y-2">
                    {data.alerts.length === 0 ? (
                      <div className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                        현재 확인할 정산 이슈가 없습니다.
                      </div>
                    ) : (
                      data.alerts.map((alert) => (
                        <div
                          key={`${alert.title}-${alert.description}`}
                          className={`rounded-xl border p-3 ${
                            alert.level === "danger"
                              ? "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
                              : "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                          }`}
                        >
                          <p className="text-xs font-black">{alert.title}</p>
                          <p className="mt-1 text-xs font-semibold leading-relaxed">{alert.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-850 dark:text-white">오더/페이먼트 기록</h3>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-300">조회 기간 내 주문과 결제 기록을 확인하고 선택 삭제할 수 있습니다.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex h-9 min-w-[260px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <input
                      value={recordSearchQuery}
                      onChange={(event) => setRecordSearchQuery(event.target.value)}
                      placeholder="기록 검색"
                      className="min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={deleteSelectedRecords}
                    disabled={selectedRecords.length === 0 || isDeletingRecords}
                    className="flex h-9 items-center justify-center gap-2 rounded-xl bg-rose-500 px-3 text-xs font-black text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isDeletingRecords ? "삭제 중" : `선택 삭제 ${selectedRecords.length}`}
                  </button>
                </div>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[1240px] text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 text-xs font-black text-slate-400 dark:bg-slate-800 dark:text-slate-300">
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={filteredRecordRows.length > 0 && selectedVisibleRecordCount === filteredRecordRows.length}
                          onChange={toggleAllRecords}
                          aria-label="전체 기록 선택"
                        />
                      </th>
                      <th className="px-4 py-3">시각</th>
                      <th className="px-4 py-3">오더</th>
                      <th className="px-4 py-3">페이먼트</th>
                      <th className="px-4 py-3 text-right">매출</th>
                      <th className="px-4 py-3 text-right">순매출</th>
                      <th className="px-4 py-3 text-right">환불</th>
                      <th className="px-4 py-3">환불 사유</th>
                      <th className="px-4 py-3 text-right">추정 원가</th>
                      <th className="px-4 py-3 text-right">추정 이윤</th>
                      <th className="px-4 py-3 text-right">상품수</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {filteredRecordRows.map((row) => (
                      <tr key={row.recordId} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRecordIds.has(row.recordId)}
                            onChange={() => toggleRecordSelection(row.recordId)}
                            aria-label={`${row.orderId} 선택`}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-300">{formatKstDateTime(row.timestamp)}</td>
                        <td className="px-4 py-3">
                          <div className="fc">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                              {row.tableName}{row.displayNumber ? ` #${row.displayNumber}` : ""}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-slate-400">{row.orderId}</span>
                            <span className="text-[11px] font-black text-slate-400">{row.orderStatus ?? "-"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="fc">
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200">{row.paymentStatus ?? "-"}</span>
                            <span className="font-mono text-[11px] font-bold text-slate-400">{row.paymentId ?? "-"}</span>
                            <span className="text-[11px] font-bold text-slate-400">{row.paymentCode ? `code ${row.paymentCode}` : ""}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-black text-slate-850 dark:text-white">{formatWon(row.grossSales)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-200">{formatWon(row.netSales)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-rose-500">{formatWon(row.refundAmount)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-300">{row.refundReason ?? "-"}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-200">{formatWon(row.estimatedCost)}</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-emerald-600 dark:text-emerald-400">{formatWon(row.estimatedProfit)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-200">{row.itemCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recordRows.length === 0 && (
                  <div className="p-8 text-center text-sm font-bold text-slate-400">선택한 기간의 오더/페이먼트 기록이 없습니다.</div>
                )}
                {data.recordRows.length > 0 && filteredRecordRows.length === 0 && (
                  <div className="p-8 text-center text-sm font-bold text-slate-400">검색 조건과 일치하는 기록이 없습니다.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AnalyticsPage;
