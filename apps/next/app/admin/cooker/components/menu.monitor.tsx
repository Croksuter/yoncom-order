"use client";

import { useState } from "react";
import useTableStore from "~/stores/table.store";
import useMenuStore from "~/stores/menu.store";
import MenuInstance from "./menu.instance";
import MenuCompleteModal from "./menu.complete.modal";
import { menuOrderStatus } from "db/schema";
import { isKitchenOrder } from "~/lib/order-status";
import { getMenuOrderProgress } from "~/lib/menu-order-progress";

const getMenuFallbackImage = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("삼겹살") || lower.includes("고기") || lower.includes("pork") || lower.includes("제육") || lower.includes("목살")) {
    return "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80";
  }
  if (lower.includes("찌개") || lower.includes("국") || lower.includes("stew") || lower.includes("soup") || lower.includes("탕") || lower.includes("어묵")) {
    return "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80";
  }
  if (lower.includes("에이드") || lower.includes("음료") || lower.includes("ade") || lower.includes("drink") || lower.includes("주스") || lower.includes("맥주") || lower.includes("beer") || lower.includes("콜라") || lower.includes("사이다")) {
    return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80";
  }
  if (lower.includes("밥") || lower.includes("비빔밥") || lower.includes("rice") || lower.includes("덮밥") || lower.includes("볶음밥")) {
    return "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80";
  }
  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80";
};

export default function MenuMonitor({
  menuId,
  compact = false,
}: {
  menuId: string;
  compact?: boolean;
}) {
  const [menuCompleteModalOpen, setMenuCompleteModalOpen] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [menuOrderId, setMenuOrderId] = useState("");
  const [tableName, setTableName] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(0);
  const { menus } = useMenuStore();
  const { tables } = useTableStore();

  const menu = menus.find((menu) => menu.id === menuId);

  if (!menu) {
    return (
      <div className={`${compact ? "min-w-0 h-full min-h-0" : "min-w-[320px] max-w-[360px] h-[calc(100vh-280px)]"} flex flex-col bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl p-4 gap-4 animate-pulse shrink-0`}>
        <div className={`${compact ? "h-20" : "h-32"} w-full bg-slate-200 dark:bg-slate-800 rounded-xl`}></div>
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  const menuOrders = tables
    .flatMap((table) => ({
      orders: table.tableContexts[0]?.orders || [],
      tableName: table.name,
    }))
    .flatMap(({ orders, tableName }) => orders
      .filter(isKitchenOrder)
      .flatMap(
        (order) => order.menuOrders
          .filter(menuOrder => menuOrder.menuId === menuId)
          .filter(menuOrder => menuOrder.status === menuOrderStatus.PENDING)
          .filter(menuOrder => getMenuOrderProgress(menuOrder).pendingQuantity > 0)
          .map(menuOrder => ({ ...menuOrder, timestamp: order.createdAt })),
      ).map((menuOrder) => ({
        ...getMenuOrderProgress(menuOrder),
        id: menuOrder.id,
        menuId: menu.id,
        menuName: menu.name,
        menuPrice: menu.price,
        quantity: getMenuOrderProgress(menuOrder).pendingQuantity,
        totalQuantity: menuOrder.quantity,
        status: menuOrder.status,
        tableName,
        timestamp: menuOrder.timestamp,
      })),
    );
  const totalPendingQuantity = menuOrders.reduce((total, menuOrder) => total + menuOrder.pendingQuantity, 0);

  return (
    <section className={`${compact ? "min-w-[200px] h-full min-h-0" : "min-w-[200px] max-w-[360px] h-[calc(100vh-240px)]"} flex flex-col bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl p-4 gap-4 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex-shrink-0`}>
      {/* Menu Column Blurred Image Header */}
      <div className={`${compact ? "h-20" : "h-32"} relative w-full rounded-xl overflow-hidden shadow-inner shrink-0 group flex-shrink-0 select-none`}>
        <img
          alt={menu.name}
          className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-500"
          src={menu.image || getMenuFallbackImage(menu.name)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent flex items-end p-4">
          <h2 className={`${compact ? "text-lg" : "text-xl"} font-black text-white tracking-tight drop-shadow-sm truncate`}>
            {menu.name}
          </h2>
        </div>
        <div className="absolute right-3 top-3 z-10 rounded-full bg-white/95 px-3 py-1.5 text-lg font-black leading-none text-slate-800 shadow-sm ring-1 ring-black/5 dark:bg-slate-950/90 dark:text-slate-100 dark:ring-white/10">
          x{totalPendingQuantity}
        </div>
      </div>

      {/* Orders List for Menu */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full">
        {menuOrders
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((menuOrder) => (
            <MenuInstance
              key={menuOrder.id}
              order={menuOrder}
              onClick={() => {
                setMenuName(menuOrder.menuName);
                setMenuOrderId(menuOrder.id);
                setTableName(menuOrder.tableName);
                setPendingQuantity(menuOrder.pendingQuantity);
                setMenuCompleteModalOpen(true);
              }}
            />
          ))
        }

        {menuOrders.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 bg-white/40 dark:bg-slate-900/30 border border-dashed border-slate-200/50 dark:border-slate-800/50 rounded-xl p-4 select-none">
            <span className="text-3xl filter grayscale opacity-60">🍳</span>
            <p className="text-sm font-bold text-slate-400 dark:text-slate-300 mt-2">대기 주문 없음</p>
          </div>
        )}
      </div>

      <MenuCompleteModal
        openState={menuCompleteModalOpen}
        setOpenState={setMenuCompleteModalOpen}
        menuName={menuName}
        tableName={tableName}
        menuOrderId={menuOrderId}
        pendingQuantity={pendingQuantity}
      />
    </section>
  );
}
