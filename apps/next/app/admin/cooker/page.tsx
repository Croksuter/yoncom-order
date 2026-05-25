"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import MenuAddModal from "./components/menu.add.modal";
import MenuMonitor from "./components/menu.monitor";
import MenuRemoveModal from "./components/menu.remove.modal";
import { isKitchenOrder } from "~/lib/order-status";
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

export default function AdminCookerPage() {
  const { menus } = useMenuStore();
  const { tables, bankTransactions } = useTableStore();

  const [menuAddModalOpen, setMenuAddModalOpen] = useState(false);
  const [menuRemoveModalOpen, setMenuRemoveModalOpen] = useState(false);
  const [monitoringMenus, setMonitoringMenus] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const tablesList = tables ?? [];
  const bankTransactionsList = bankTransactions ?? [];

  // Top stats dynamic calculations (same as POS page)
  const confirmedOrders = tablesList
    .filter((table) => table.tableContexts?.[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts?.[0]?.orders ?? [])
    .filter((order) => order.payment?.status === "PAID");

  const totalRevenue = confirmedOrders.reduce((acc, order) => {
    return acc + (order.payment?.expectedTransferAmount ?? order.payment?.amount ?? 0);
  }, 0);

  const reviewTransactions = bankTransactionsList.filter((transaction) => transaction.status !== "IGNORED");
  const pendingPaymentsCount = reviewTransactions.length;

  const refundPendingOrders = tablesList
    .filter((table) => table.tableContexts?.[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts?.[0]?.orders ?? [])
    .filter((order) => order.deletedAt === null && order.payment?.status === "REFUND_PENDING");
  const issuesCount = refundPendingOrders.length;

  const pendingMenuIds = useMemo(() => {
    const menuIds = new Set<string>();

    for (const table of tables) {
      for (const order of table.tableContexts[0]?.orders ?? []) {
        if (!isKitchenOrder(order)) {
          continue;
        }

        for (const menuOrder of order.menuOrders) {
          if (menuOrder.deletedAt === null && menuOrder.status === "PENDING") {
            menuIds.add(menuOrder.menuId);
          }
        }
      }
    }

    return [...menuIds].filter((menuId) => menus.some((menu) => menu.id === menuId));
  }, [menus, tables]);

  useEffect(() => {
    if (monitoringMenus.length === 0 && pendingMenuIds.length > 0) {
      setMonitoringMenus(pendingMenuIds);
    }
  }, [monitoringMenus.length, pendingMenuIds]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300">
      {/* Collapsible Left Sidebar */}
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
                className="flex items-center gap-3.5 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200 font-medium rounded-2xl transition-all duration-200"
              >
                <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span className="text-sm truncate">Dashboard</span>}
              </a>

              {/* Active Kitchen Tab */}
              <a 
                href="/admin/cooker" 
                className="flex items-center gap-3.5 px-4 py-3 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 font-bold rounded-2xl border border-brand-100 dark:border-brand-900/30 transition-all duration-200"
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

      {/* Main Workspace (Top Header + Kitchen monitors) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Section */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 h-20 flex-shrink-0 flex justify-between items-center px-6 z-10 transition-colors duration-300">
          <div className="flex flex-col">
            <h2 className="font-extrabold text-xl sm:text-2xl text-slate-800 dark:text-white tracking-tight">
              Kitchen Monitor
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">메뉴별 실시간 대기열 모니터링</p>
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

        {/* Cooker Workspace Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex flex-col gap-4">
          <div className="flex h-fit w-full flex-wrap justify-between items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm flex-shrink-0">
            <div className="fc text-left">
              <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">모니터링 대상 메뉴 관리</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">화면에 모니터링할 메뉴를 추가하거나 제거할 수 있습니다.</p>
            </div>
            <div className="flex gap-2">
              <Button 
                disabled={menus.length === 0} 
                className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs h-8.5 px-4.5 rounded-xl transition-all shadow-sm shadow-brand-500/10 shrink-0"
                onClick={() => setMenuAddModalOpen(true)}
              >
                메뉴 추가
              </Button>
              <Button
                disabled={monitoringMenus.length === 0}
                variant="outline"
                className="border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs h-8.5 px-4.5 rounded-xl transition-all shrink-0"
                onClick={() => setMenuRemoveModalOpen(true)}
              >
                메뉴 제거
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row gap-3 p-2 overflow-y-auto sm:overflow-x-auto min-h-[30rem] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {monitoringMenus.map((menuId) => (
              <MenuMonitor key={menuId} menuId={menuId} />
            ))}
            {monitoringMenus.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-8 shadow-sm">
                <span className="text-5xl">🍳</span>
                <p className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-4">모니터링 중인 메뉴가 없습니다</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-semibold">우측 상단의 '메뉴 추가' 버튼을 눌러 모니터링을 시작해 보세요.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <MenuAddModal
        openState={menuAddModalOpen}
        setOpenState={setMenuAddModalOpen}
        monitoringMenus={monitoringMenus}
        setMonitoringMenus={setMonitoringMenus}
      />
      <MenuRemoveModal
        openState={menuRemoveModalOpen}
        setOpenState={setMenuRemoveModalOpen}
        monitoringMenus={monitoringMenus}
        setMonitoringMenus={setMonitoringMenus}
      />
    </div>
  );
}
