import { useEffect, useState } from "react";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import TableSetModal from "./table.set.modal";
import { dateDiffString } from "~/lib/date";
import useMenuStore from "~/stores/menu.store";
import { Clock, Plus } from "lucide-react";
import TableDetailModal from "./table.detail.modal";
import { getMenuOrderStatusIcon, isKitchenOrder, isUnresolvedPaymentOrder } from "~/lib/order-status";

export default function TableInstance({
  table
}: {
  table: AdminTableResponse.Get["result"][0]
}) {
  const activeTableContext = table.tableContexts.find((tableContext) => tableContext.deletedAt === null);
  const inUse = activeTableContext !== undefined;
  const [modalOpen, setModalOpen] = useState(false);
  const [now, setNow] = useState(0);

  const { menus } = useMenuStore();

  const menuId2menu = (menuId: string) => menus.find((menu) => menu.id === menuId);
  const menuOrders = activeTableContext?.orders
    .filter((order) => isKitchenOrder(order) || isUnresolvedPaymentOrder(order))
    .flatMap((order) => order.menuOrders.map((menuOrder) => ({ menuOrder, order }))) || [];
  const amount = menuOrders.reduce(
    (acc, { menuOrder }) => acc + (menuId2menu(menuOrder.menuId)?.price ?? 0) * menuOrder.quantity,
    0,
  );

  const isOnOrder = activeTableContext?.orders.some((order) => 
    isKitchenOrder(order)
    && order.menuOrders.some((menuOrder) => (
      menuOrder.status === "PENDING"
      || menuOrder.status === "READY"
    ))
  ) || false;

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {inUse ? (
        /* Occupied Table (Stitch Design) */
        <div 
          className="aspect-square bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col group"
          onClick={() => setModalOpen(true)}
        >
          <div className="h-1.5 bg-brand-500 w-full flex-shrink-0 group-hover:bg-brand-600 transition-colors"></div>
          <div className="p-3.5 flex-1 flex flex-col">
            <div className="flex justify-between items-start flex-shrink-0 gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-100 leading-none group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors truncate max-w-full">
                  {table.name}
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 truncate">
                  {table.seats}인석
                </p>
              </div>
              <span className="bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                Occupied
              </span>
            </div>

            {/* Menu orders scrollable list */}
            <div className="flex-1 my-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-1 py-1 border-y border-slate-50 dark:border-slate-800/40">
              {menuOrders.map(({ menuOrder, order }) => (
                <div 
                  key={menuOrder.id} 
                  className="flex justify-between items-center text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                >
                  <span className="flex items-center gap-1 truncate max-w-[100px]">
                    <span className="scale-75 opacity-70 flex-shrink-0">{getMenuOrderStatusIcon(menuOrder, order)}</span>
                    <span className="truncate">{menuId2menu(menuOrder.menuId)?.name}</span>
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-extrabold flex-shrink-0">x{menuOrder.quantity}</span>
                </div>
              ))}
            </div>

            {/* Bottom Section */}
            <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center flex-shrink-0">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                {amount.toLocaleString()}원
              </span>
              <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] font-bold">
                <Clock className="h-3 w-3 text-brand-500 animate-pulse" />
                <span>{
                  dateDiffString(now, activeTableContext.createdAt).startsWith("-")
                    ? "00:00"
                    : dateDiffString(now, activeTableContext.createdAt)
                }</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Available Table (Stitch Design) */
        <div 
          className="aspect-square bg-slate-50/40 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-brand-500/50 hover:bg-brand-50/5 dark:hover:bg-brand-950/10 transition-all cursor-pointer p-4 active:scale-[0.98] min-w-0 w-full"
          onClick={() => setModalOpen(true)}
        >
          <h4 className="font-extrabold text-base text-slate-400 dark:text-slate-600 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors leading-none truncate w-full max-w-full px-2">
            {table.name}
          </h4>
          <p className="text-[10px] text-slate-400/80 dark:text-slate-650 font-bold mt-1 truncate w-full max-w-full px-2">
            {table.seats}인석
          </p>
          <div className="mt-3.5 w-9 h-9 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700/60 group-hover:scale-110 group-hover:bg-brand-500 group-hover:border-brand-500 group-hover:text-white transition-all duration-300">
            <Plus className="h-4.5 w-4.5 text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors" />
          </div>
        </div>
      )}
      <TableDetailModal
        table={table}
        openState={modalOpen}
        setOpenState={setModalOpen}
      />
    </>
  );
}
