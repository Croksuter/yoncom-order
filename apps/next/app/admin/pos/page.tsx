"use client";

import { useState } from "react";
import Inventories from "./components/inventory/inventories";
import Orders from "./components/order/orders";
import Tables from "./components/table/tables";
import useTableStore from "~/stores/table.store";
import { traceEvent } from "~/lib/verification-trace";
import { 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  LayoutDashboard, 
  Receipt, 
  Grid3X3, 
  BarChart3, 
  UtensilsCrossed, 
  AlertCircle,
  ChefHat
} from "lucide-react";

export default function AdminPosPage() {
  const [isInventoriesOpen, setIsInventoriesOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { tables, bankTransactions } = useTableStore();
  const tablesList = tables ?? [];
  const bankTransactionsList = bankTransactions ?? [];

  // 1. 누적 매출 (PAID 상태의 결제 금액 합산)
  const confirmedOrders = tablesList
    .filter((table) => table.tableContexts?.[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts?.[0]?.orders ?? [])
    .filter((order) => order.payment?.status === "PAID");

  const totalRevenue = confirmedOrders.reduce((acc, order) => {
    return acc + (order.payment?.expectedTransferAmount ?? order.payment?.amount ?? 0);
  }, 0);

  // 2. 입금 대기 건수
  const reviewTransactions = bankTransactionsList.filter((transaction) => transaction.status !== "IGNORED");
  const pendingPaymentsCount = reviewTransactions.length;

  // 3. 환불 대기 건수 (환불 이슈)
  const refundPendingOrders = tablesList
    .filter((table) => table.tableContexts?.[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts?.[0]?.orders ?? [])
    .filter((order) => order.deletedAt === null && order.payment?.status === "REFUND_PENDING");
  const issuesCount = refundPendingOrders.length;

  const toggleInventories = () => {
    const nextOpen = !isInventoriesOpen;
    traceEvent("client", "ui.panel.state", {
      panel: "admin.pos.inventory",
      from: isInventoriesOpen,
      to: nextOpen,
    });
    setIsInventoriesOpen(nextOpen);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300">
      {/* Collapsible Left Sidebar (Stitch Design) */}
      <aside className={`hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-lg h-full transition-all duration-300 ease-in-out relative z-20 ${
        isSidebarCollapsed ? "w-20" : "w-72"
      }`}>
        <div className="p-5 flex flex-col gap-6 h-full justify-between">
          <div className="flex flex-col gap-6">
            {/* Logo Section */}
            <div className="flex items-center gap-3 py-2 px-1">
              <div className="w-10 h-10 rounded-2xl bg-brand-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 active:scale-95 transition-transform flex-shrink-0">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              {!isSidebarCollapsed && (
                <h1 className="font-extrabold text-xl text-slate-800 dark:text-white tracking-tight animate-fade-in truncate">
                  Festival POS
                </h1>
              )}
            </div>

            {/* Sidebar Navigation */}
            <nav className="flex flex-col gap-1.5">
              <a 
                href="/admin/pos" 
                className="flex items-center gap-3.5 px-4 py-3 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 font-bold rounded-2xl border border-brand-100 dark:border-brand-900/30 transition-all duration-200"
              >
                <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span className="text-sm truncate">Dashboard</span>}
              </a>

              {/* Real Kitchen Tab */}
              <a 
                href="/admin/cooker" 
                className="flex items-center gap-3.5 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200 font-medium rounded-2xl transition-all duration-200"
              >
                <ChefHat className="h-5 w-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span className="text-sm truncate">Kitchen</span>}
              </a>

              {[
                { label: "Orders", icon: Receipt },
                { label: "Table Management", icon: Grid3X3 },
                { label: "Inventory", icon: Package },
                { label: "Sales Analytics", icon: BarChart3 }
              ].map((tab, idx) => {
                const Icon = tab.icon;
                return (
                  <a 
                    key={idx}
                    href="#" 
                    className="flex items-center gap-3.5 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200 font-medium rounded-2xl transition-all duration-200"
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!isSidebarCollapsed && <span className="text-sm truncate">{tab.label}</span>}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Collapse Toggle */}
          <div className="flex flex-col gap-4">
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-black flex items-center justify-center flex-shrink-0 text-sm shadow-inner">
                BF
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">Baseball Fan</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Manager</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 active:scale-[0.98] transition-all duration-200 font-semibold text-xs"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span>메뉴 접기</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace (Top Header + POS panels) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Section */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 h-20 flex-shrink-0 flex justify-between items-center px-6 z-10 transition-colors duration-300">
          <div className="flex flex-col">
            <h2 className="font-extrabold text-xl sm:text-2xl text-slate-800 dark:text-white tracking-tight">
              Dashboard Overview
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">POS Dashboard & Live Status</p>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Sales</span>
              <span className="text-lg sm:text-xl font-black text-brand-600 dark:text-brand-400">
                ₩{totalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending Payments</span>
              <span className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-200">
                {pendingPaymentsCount}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] sm:text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Issues</span>
              <span className={`text-lg sm:text-xl font-black flex items-center gap-1.5 ${
                issuesCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"
              }`}>
                {issuesCount}
                {issuesCount > 0 && <AlertCircle className="h-4 w-4 text-rose-500 animate-pulse" />}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic 3-Column Workspace */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden p-2 flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 relative transition-colors duration-300">
          {/* 주문 현황: 좌측 고정 (1/4) */}
          <div className="min-h-[18rem] w-full lg:h-full lg:min-h-0 lg:w-1/4 transition-all duration-300">
            <Orders />
          </div>

          {/* 테이블 현황: 가운데 (재고 현황이 열려있으면 1/2, 닫혀있으면 3/4) */}
          <div className={`min-h-[24rem] w-full items-center justify-center fc lg:h-full lg:min-h-0 transition-all duration-300 ${
            isInventoriesOpen ? "lg:w-1/2" : "lg:w-3/4"
          }`}>
            <div className="w-full h-full p-2 relative">
              <Tables />
              
              {/* 재고 현황 토글 버튼 (PC 환경 우측 하단 고정) */}
              <button
                onClick={toggleInventories}
                className="absolute bottom-6 right-6 hidden lg:flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-full shadow-lg shadow-brand-500/20 active:scale-95 transition-all z-50 border border-brand-400/20"
              >
                {isInventoriesOpen ? (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-sm font-semibold">재고 접기</span>
                  </>
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="text-sm font-semibold">재고 열기</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 재고 현황: 우측 슬라이드 (열려있으면 1/4, 닫혀있으면 w-0) */}
          <div className={`lg:h-full lg:min-h-0 transition-all duration-300 overflow-hidden ${
            isInventoriesOpen 
              ? "flex min-h-[18rem] w-full lg:w-1/4 opacity-100" 
              : "h-0 lg:h-full w-0 lg:w-0 opacity-0 pointer-events-none"
          }`}>
            <Inventories />
          </div>
          
          {/* 모바일 화면용 하단 간이 토글 버튼 */}
          <button
            onClick={toggleInventories}
            className="lg:hidden fixed bottom-4 right-4 flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-full shadow-lg shadow-brand-500/20 active:scale-95 transition-all z-50 border border-brand-400/20"
          >
            <Package className="h-4 w-4" />
            <span className="text-sm font-semibold">
              {isInventoriesOpen ? "재고 접기" : "재고 보기"}
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
