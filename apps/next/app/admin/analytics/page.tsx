"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import type * as AdminAnalyticsResponse from "shared/types/responses/admin/analytics";
import { api } from "~/lib/query";
import {
  AlertTriangle,
  Banknote,
  Download,
  LineChart,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Scale,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const kstOffsetMs = 9 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const defaultTargetMarginPercent = "35";
const defaultTargetMarginBps = 3500;
const presetOptions = [
  { id: "today", label: "오늘" },
  { id: "7d", label: "7일" },
  { id: "30d", label: "30일" },
  { id: "custom", label: "사용자 지정" },
] as const;

type Preset = (typeof presetOptions)[number]["id"];

function startOfKstDay(timestamp = Date.now()) {
  const kstDate = new Date(timestamp + kstOffsetMs);
  return Date.UTC(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate()) - kstOffsetMs;
}

function toDateInputValue(timestamp: number) {
  const date = new Date(timestamp + kstOffsetMs);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function fromDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) - kstOffsetMs;
}

function getPresetRange(preset: Preset) {
  const todayStart = startOfKstDay();
  if (preset === "today") return { from: todayStart, to: todayStart + dayMs };
  if (preset === "7d") return { from: todayStart - 6 * dayMs, to: todayStart + dayMs };
  if (preset === "30d") return { from: todayStart - 29 * dayMs, to: todayStart + dayMs };
  return { from: todayStart, to: todayStart + dayMs };
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
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-300">{label}</p>
          <p className="mt-2 truncate text-xl font-black text-slate-850 dark:text-white">{value}</p>
          <p className={`mt-1 text-xs font-bold ${helperClass}`}>{helper}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/20 dark:text-brand-300">
          <Icon className="h-4.5 w-4.5" />
        </div>
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
  const [targetMarginPercent, setTargetMarginPercent] = useState(defaultTargetMarginPercent);
  const [data, setData] = useState<AdminAnalyticsResponse.Get["result"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
    void loadAnalytics();
  }, [loadAnalytics]);

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
        value: formatWon(data.summary.estimatedCost.value),
        helper: formatDelta(data.summary.estimatedCost.deltaRate),
        helperClass: kpiTone(data.summary.estimatedCost.deltaRate),
        icon: PackageSearch,
      },
      {
        label: "추정 이윤",
        value: formatWon(data.summary.estimatedProfit.value),
        helper: formatDelta(data.summary.estimatedProfit.deltaRate),
        helperClass: kpiTone(data.summary.estimatedProfit.deltaRate),
        icon: WalletCards,
      },
      {
        label: "원가율",
        value: formatPercent(data.summary.costRate),
        helper: `${data.summary.soldItemCount.toLocaleString()}개 판매`,
        helperClass: "text-slate-400",
        icon: Scale,
      },
    ];
  }, [data]);

  const simulatedMenuRows = useMemo(() => {
    if (!data) return [];
    return data.menuRows.map((row) => {
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

  const pricingSummary = useMemo(() => {
    const currentRevenue = simulatedMenuRows.reduce((sum, row) => sum + row.revenue, 0);
    const currentProfit = simulatedMenuRows.reduce((sum, row) => sum + row.estimatedProfit, 0);
    const recommendedRevenue = simulatedMenuRows.reduce((sum, row) => sum + row.recommendedRevenue, 0);
    const recommendedProfit = simulatedMenuRows.reduce((sum, row) => sum + row.recommendedProfit, 0);
    return {
      currentRevenue,
      currentProfit,
      recommendedRevenue,
      recommendedProfit,
      revenueDelta: recommendedRevenue - currentRevenue,
      profitDelta: recommendedProfit - currentProfit,
    };
  }, [simulatedMenuRows]);

  const exportCsv = () => {
    if (!data) return;
    const header = ["메뉴", "판매수량", "매출", "적용원가", "이윤", "원가율", "현재가", "목표마진", "권장가", "현재가대비"];
    const rows = simulatedMenuRows.map((row) => [
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
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sales-analytics-${toDateInputValue(data.from)}-${toDateInputValue(data.to - 1)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
                type="date"
                value={toDateInputValue(range.from)}
                onChange={(event) => {
                  setPreset("custom");
                  setRange((prev) => ({ ...prev, from: fromDateInputValue(event.target.value) }));
                }}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              />
              <input
                type="date"
                value={toDateInputValue(range.to - 1)}
                onChange={(event) => {
                  setPreset("custom");
                  setRange((prev) => ({ ...prev, to: fromDateInputValue(event.target.value) + dayMs }));
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
                onClick={exportCsv}
                disabled={!data}
                className="flex h-9 items-center gap-2 rounded-xl bg-emerald-500 px-3 text-xs font-black text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
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
                    <table className="w-full min-w-[920px] text-left">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-black text-slate-400 dark:bg-slate-800/40 dark:text-slate-300">
                          <th className="px-4 py-3">메뉴</th>
                          <th className="px-4 py-3 text-right">판매수량</th>
                          <th className="px-4 py-3 text-right">매출</th>
                          <th className="px-4 py-3 text-right">적용 원가</th>
                          <th className="px-4 py-3 text-right">이윤</th>
                          <th className="px-4 py-3 text-right">원가율</th>
                          <th className="px-4 py-3 text-right">현재가</th>
                          <th className="px-4 py-3 text-right">권장가</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {simulatedMenuRows.slice(0, 12).map((row) => (
                          <tr key={row.menuId} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 dark:text-slate-100">{row.menuName}</span>
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
                            <span className="text-slate-400">{formatWon(row.revenue)}</span>
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
          </>
        )}
      </div>
    </div>
  );
}

export default AnalyticsPage;
