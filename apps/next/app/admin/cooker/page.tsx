"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import MenuAddModal from "./components/menu.add.modal";
import MenuMonitor from "./components/menu.monitor";
import MenuRemoveModal from "./components/menu.remove.modal";
import { isKitchenOrder } from "~/lib/order-status";

export default function AdminCookerPage() {
  const { menus } = useMenuStore();
  const { tables } = useTableStore();

  const [menuAddModalOpen, setMenuAddModalOpen] = useState(false);
  const [menuRemoveModalOpen, setMenuRemoveModalOpen] = useState(false);
  
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
          if (menuOrder.deletedAt === null && menuOrder.status === "PENDING") {
            menuIds.add(menuOrder.menuId);
          }
        }
      }
    }

    return [...menuIds].filter((menuId) => menusList.some((menu) => menu.id === menuId));
  }, [menus, tables]);

  // Load selection from localStorage or initialize with pending orders on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

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
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">화면에 실시간으로 모니터링할 메뉴를 추가하거나 제거할 수 있습니다.</p>
        </div>
        <div className="flex gap-2">
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
            className="border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs h-9.5 px-5 rounded-xl transition-all shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setMenuRemoveModalOpen(true)}
          >
            메뉴 제거
          </Button>
        </div>
      </div>

      {/* Kanban Board Layout for Kitchen Display System (Stitch canvas) */}
      <div className="flex-1 flex flex-row gap-6 p-2 overflow-x-auto items-start h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {monitoringMenus.map((menuId) => (
          <MenuMonitor key={menuId} menuId={menuId} />
        ))}
        {monitoringMenus.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-8 shadow-sm h-full w-full">
            <span className="text-6xl animate-bounce">🍳</span>
            <p className="text-lg font-extrabold text-slate-800 dark:text-slate-200 mt-4">모니터링 중인 메뉴가 없습니다</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 font-semibold max-w-sm">
              상단의 '메뉴 추가' 버튼을 눌러 화면에 띄울 조리 대기열 메뉴들을 선택해 주세요.
            </p>
          </div>
        )}
      </div>

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
    </div>
  );
}
