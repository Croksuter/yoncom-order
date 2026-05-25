
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import { dateDiffString } from "~/lib/date";
import { useEffect, useState } from "react";
import { getMenuOrderStatusIcon, getOrderStatusLabel } from "~/lib/order-status";

export default function OrderInstance({ 
  order,
  onClick,
}: { 
  order: AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number];
  onClick: () => void;
}) {
  const [now, setNow] = useState(0);

  const { tables } = useTableStore();
  const { menus } = useMenuStore();
  const table = tables.find((table) => table.tableContexts.some((tableContext) => tableContext.id === order.tableContextId));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const statusLabel = getOrderStatusLabel(order);

  let borderClass = "border-l-4 border-l-slate-300 dark:border-l-slate-700";
  let badgeClass = "bg-slate-50 dark:bg-slate-900/20 text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-800";
  let hoverClass = "hover:border-slate-350 dark:hover:border-slate-600 hover:shadow-[0_8px_20px_rgba(148,163,184,0.06)]";

  if (statusLabel.includes("환불 대기") || statusLabel.includes("취소") || statusLabel.includes("만료")) {
    borderClass = "border-l-4 border-l-rose-500 dark:border-l-rose-500";
    badgeClass = "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30";
    hoverClass = "hover:border-rose-400/50 dark:hover:border-rose-500/30 hover:shadow-[0_8px_20px_rgba(244,63,94,0.08)]";
  } else if (statusLabel.includes("입금 대기") || statusLabel.includes("확인 필요") || statusLabel.includes("조리 중") || statusLabel.includes("조리 대기")) {
    borderClass = "border-l-4 border-l-amber-500 dark:border-l-amber-500";
    badgeClass = "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30";
    hoverClass = "hover:border-amber-400/50 dark:hover:border-amber-500/30 hover:shadow-[0_8px_20px_rgba(245,158,11,0.08)]";
  } else if (statusLabel.includes("조리 완료") || statusLabel.includes("준비 완료") || statusLabel.includes("수령 완료") || statusLabel.includes("결제 완료")) {
    borderClass = "border-l-4 border-l-emerald-500 dark:border-l-emerald-500";
    badgeClass = "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30";
    hoverClass = "hover:border-emerald-400/50 dark:hover:border-emerald-500/30 hover:shadow-[0_8px_20px_rgba(16,185,129,0.08)]";
  }

  return (
    <div 
      className={`bg-slate-50/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 ${borderClass} ${hoverClass} p-3.5 rounded-2xl transition-all duration-300 cursor-pointer flex flex-col gap-3 group`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="fc">
          <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
            {table?.name ?? "테이블"}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
            {dateDiffString(now, order.createdAt).startsWith("-") 
              ? "00:00" 
              : dateDiffString(now, order.createdAt)}
          </span>
        </div>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${badgeClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-850 pt-2.5">
        {order.menuOrders.map((menuOrder) => {
          const menu = menus.find((menu) => menu.id === menuOrder.menuId);

          return (
            <div 
              key={menuOrder.menuId} 
              className="flex justify-between items-center text-xs font-semibold text-slate-650 dark:text-slate-350"
            >
              <span className="flex items-center gap-1.5">
                <span className="scale-90 opacity-80">{getMenuOrderStatusIcon(menuOrder, order)}</span>
                <span className="truncate max-w-[140px]">{menu?.name}</span>
              </span>
              <span className="text-slate-400 dark:text-slate-500 font-extrabold">x{menuOrder.quantity}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

