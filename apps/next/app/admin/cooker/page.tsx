"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import MenuAddModal from "./components/menu.add.modal";
import MenuCompleteModal from "./components/menu.complete.modal";
import MenuInstance from "./components/menu.instance";
import MenuMonitor from "./components/menu.monitor";
import MenuRemoveModal from "./components/menu.remove.modal";
import { menuOrderStatus } from "db/schema";
import { isKitchenOrder } from "~/lib/order-status";
import { getMenuOrderProgress } from "~/lib/menu-order-progress";
import { Columns3, ListOrdered, Rows2 } from "lucide-react";

const cookerViewModes = ["columns", "twoRows", "quick"] as const;
type CookerViewMode = (typeof cookerViewModes)[number];

function isCookerViewMode(value: string | null): value is CookerViewMode {
  return cookerViewModes.includes(value as CookerViewMode);
}

export default function AdminCookerPage() {
  const { menus } = useMenuStore();
  const { tables } = useTableStore();

  const [menuAddModalOpen, setMenuAddModalOpen] = useState(false);
  const [menuRemoveModalOpen, setMenuRemoveModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<CookerViewMode>("columns");
  const [quickCompleteModalOpen, setQuickCompleteModalOpen] = useState(false);
  const [quickCompleteOrder, setQuickCompleteOrder] = useState<{
    id: string;
    menuId: string;
    menuName: string;
    menuPrice: number;
    quantity: number;
    totalQuantity: number;
    pendingQuantity: number;
    status: string;
    tableName: string;
    timestamp: number;
  } | null>(null);
  
  // State for monitoring menus, initialized empty for SSR safety
  const [monitoringMenus, setMonitoringMenus] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const pendingMenuIds = useMemo(() => {
    const menuIds = new Set<string>();
    const tablesList = tables ?? [];
    const menusList = menus ?? [];

    for (const table of tablesList) {
      for (const order of table.tableContexts?.[0]?.orders ?? []) {
        if (!isKitchenOrder(order)) {
          continue;
        }

        for (const menuOrder of order.menuOrders ?? []) {
          if (
            menuOrder.deletedAt === null
            && menuOrder.status === "PENDING"
            && getMenuOrderProgress(menuOrder).pendingQuantity > 0
          ) {
            menuIds.add(menuOrder.menuId);
          }
        }
      }
    }

    return [...menuIds].filter((menuId) => menusList.some((menu) => menu.id === menuId));
  }, [menus, tables]);

  const pendingMenuOrders = useMemo(() => {
    const selectedMenuIds = new Set(monitoringMenus);
    const menusById = new Map((menus ?? []).map((menu) => [menu.id, menu]));

    return (tables ?? [])
      .flatMap((table) => ({
        orders: table.tableContexts?.[0]?.orders ?? [],
        tableName: table.name,
      }))
      .flatMap(({ orders, tableName }) => orders
        .filter(isKitchenOrder)
        .flatMap((order) => order.menuOrders
          .filter((menuOrder) => menuOrder.deletedAt === null)
          .filter((menuOrder) => menuOrder.status === menuOrderStatus.PENDING)
          .filter((menuOrder) => getMenuOrderProgress(menuOrder).pendingQuantity > 0)
          .filter((menuOrder) => selectedMenuIds.has(menuOrder.menuId))
          .map((menuOrder) => {
            const menu = menusById.get(menuOrder.menuId);
            if (!menu) return null;
            const progress = getMenuOrderProgress(menuOrder);

            return {
              id: menuOrder.id,
              menuId: menu.id,
              menuName: menu.name,
              menuPrice: menu.price,
              quantity: progress.pendingQuantity,
              totalQuantity: menuOrder.quantity,
              pendingQuantity: progress.pendingQuantity,
              status: menuOrder.status,
              tableName,
              timestamp: order.createdAt,
            };
          })
          .filter((menuOrder): menuOrder is NonNullable<typeof menuOrder> => menuOrder !== null),
        ))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [menus, monitoringMenus, tables]);

  // Load selection from localStorage or initialize with pending orders on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedViewMode = localStorage.getItem("cooker_view_mode");
    if (isCookerViewMode(savedViewMode)) {
      setViewMode(savedViewMode);
    }

    const saved = localStorage.getItem("cooker_monitoring_menus");
    if (saved) {
      try {
        setMonitoringMenus(JSON.parse(saved));
        setIsInitialized(true);
        return;
      } catch (e) {
        // fallback
      }
    }

    // Default initialization only if not initialized yet and pending orders are loaded
    if (!isInitialized && pendingMenuIds.length > 0) {
      setMonitoringMenus(pendingMenuIds);
      localStorage.setItem("cooker_monitoring_menus", JSON.stringify(pendingMenuIds));
      setIsInitialized(true);
    }
  }, [pendingMenuIds.length > 0, isInitialized]);

  const updateViewMode = (nextViewMode: CookerViewMode) => {
    setViewMode(nextViewMode);
    localStorage.setItem("cooker_view_mode", nextViewMode);
  };

  // Persistent updater helper
  const updateMonitoringMenus = (newMenus: string[]) => {
    setMonitoringMenus(newMenus);
    localStorage.setItem("cooker_monitoring_menus", JSON.stringify(newMenus));
    setIsInitialized(true); // Ensure marked as initialized
  };

  // Synchronize monitoring menus with actual active menu items
  useEffect(() => {
    if (!isInitialized || menus.length === 0) return;

    const activeMenuIds = new Set(menus.filter(m => m.deletedAt === null).map(m => m.id));
    const synchronizedMenus = monitoringMenus.filter(id => activeMenuIds.has(id));

    if (synchronizedMenus.length !== monitoringMenus.length) {
      updateMonitoringMenus(synchronizedMenus);
    }
  }, [menus, isInitialized, monitoringMenus]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex flex-col gap-6 h-full animate-fade-in">
      {/* Monitoring Control Bar (Stitch Design) */}
      <div className="flex h-fit w-full flex-wrap justify-between items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex-shrink-0 animate-fade-in">
        <div className="flex flex-col text-left">
          <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-200">모니터링 대상 메뉴 관리</h4>
          <p className="text-xs text-slate-400 dark:text-slate-300 font-semibold mt-0.5">화면에 실시간으로 모니터링할 메뉴를 추가하거나 제거할 수 있습니다.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1">
            {([
              { mode: "columns", label: "메뉴 열", icon: Columns3 },
              { mode: "twoRows", label: "2행 열", icon: Rows2 },
              { mode: "quick", label: "빠른순", icon: ListOrdered },
            ] satisfies Array<{ mode: CookerViewMode; label: string; icon: typeof Columns3 }>).map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-all ${
                  viewMode === mode
                    ? "bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                }`}
                onClick={() => updateViewMode(mode)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <Button 
            disabled={menus.length === 0} 
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs h-9.5 px-5 rounded-xl transition-all shadow-sm shadow-brand-500/10 hover:shadow-md active:scale-95 shrink-0"
            onClick={() => setMenuAddModalOpen(true)}
          >
            메뉴 추가
          </Button>
          <Button
            disabled={monitoringMenus.length === 0}
            variant="outline"
            className="border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-200 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs h-9.5 px-5 rounded-xl transition-all shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setMenuRemoveModalOpen(true)}
          >
            메뉴 제거
          </Button>
        </div>
      </div>

      {/* Kanban Board Layout for Kitchen Display System (Stitch canvas) */}
      {viewMode === "quick" ? (
        <div className="flex-1 overflow-y-auto p-2 min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-3">
            {pendingMenuOrders.map((menuOrder) => (
              <MenuInstance
                key={menuOrder.id}
                order={menuOrder}
                showMenuName
                onClick={() => {
                  setQuickCompleteOrder(menuOrder);
                  setQuickCompleteModalOpen(true);
                }}
              />
            ))}
            {monitoringMenus.length > 0 && pendingMenuOrders.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center text-center py-20 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-8 shadow-sm">
                <span className="text-5xl">🍳</span>
                <p className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-4">대기 주문이 없습니다</p>
              </div>
            )}
            {monitoringMenus.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center text-center py-20 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-8 shadow-sm">
                <span className="text-5xl">🍳</span>
                <p className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-4">모니터링 중인 메뉴가 없습니다</p>
                <p className="text-xs text-slate-400 dark:text-slate-300 mt-1.5 font-semibold max-w-sm">
                  상단의 '메뉴 추가' 버튼을 눌러 화면에 띄울 조리 대기열 메뉴들을 선택해 주세요.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className={viewMode === "twoRows"
        ? "flex-1 grid grid-flow-col grid-rows-2 auto-cols-[minmax(260px,320px)] gap-6 p-2 overflow-x-auto items-stretch min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        : "flex-1 flex flex-row gap-6 p-2 overflow-x-auto items-start h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      }>
        {monitoringMenus.map((menuId) => (
          <MenuMonitor key={menuId} menuId={menuId} compact={viewMode === "twoRows"} />
        ))}
        {monitoringMenus.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-8 shadow-sm h-full w-full">
            <span className="text-6xl animate-bounce">🍳</span>
            <p className="text-lg font-extrabold text-slate-800 dark:text-slate-200 mt-4">모니터링 중인 메뉴가 없습니다</p>
            <p className="text-xs text-slate-400 dark:text-slate-300 mt-1.5 font-semibold max-w-sm">
              상단의 '메뉴 추가' 버튼을 눌러 화면에 띄울 조리 대기열 메뉴들을 선택해 주세요.
            </p>
          </div>
        )}
      </div>
      )}

      <MenuAddModal
        openState={menuAddModalOpen}
        setOpenState={setMenuAddModalOpen}
        monitoringMenus={monitoringMenus}
        setMonitoringMenus={updateMonitoringMenus}
      />
      <MenuRemoveModal
        openState={menuRemoveModalOpen}
        setOpenState={setMenuRemoveModalOpen}
        monitoringMenus={monitoringMenus}
        setMonitoringMenus={updateMonitoringMenus}
      />
      <MenuCompleteModal
        openState={quickCompleteModalOpen}
        setOpenState={setQuickCompleteModalOpen}
        menuName={quickCompleteOrder?.menuName ?? ""}
        tableName={quickCompleteOrder?.tableName ?? ""}
        menuOrderId={quickCompleteOrder?.id ?? ""}
        pendingQuantity={quickCompleteOrder?.pendingQuantity ?? 0}
      />
    </div>
  );
}
