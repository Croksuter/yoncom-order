"use client";

import { useEffect, useState } from "react";
import { dateDiffString } from "~/lib/date";
import { CheckCircle2 } from "lucide-react";

export default function MenuInstance({
  order,
  onClick,
}: {
  order: {
    id: string;
    menuId: string;
    menuName: string;
    menuPrice: number;
    quantity: number;
    status: string;
    tableName: string;
    timestamp: number;
  }
  onClick: () => void;
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const elapsedMs = now - order.timestamp;
  const elapsedSec = Math.floor(elapsedMs / 1000);

  // Time-based warning colors: normal (slate), delayed > 5m (amber), critical > 10m (rose)
  let timerClass = "text-slate-400 dark:text-slate-300 font-semibold";
  if (elapsedSec >= 600) {
    timerClass = "text-rose-500 font-bold animate-pulse flex items-center gap-1";
  } else if (elapsedSec >= 300) {
    timerClass = "text-amber-500 font-bold flex items-center gap-1";
  }

  const formattedTime = dateDiffString(now, order.timestamp).startsWith("-")
    ? "00:00"
    : dateDiffString(now, order.timestamp);

  return (
    <article
      onClick={onClick}
      className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all duration-200 relative group overflow-hidden cursor-pointer active:scale-[0.99] select-none"
    >
      {/* Premium accent strip on hover */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-brand-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>

      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 tracking-tight group-hover:text-brand-500 transition-colors truncate w-full max-w-full block">
            {order.tableName}
          </h3>
          <span className={`text-base mt-1 ${timerClass} truncate block w-full`}>
            {formattedTime}
          </span>
        </div>

        {/* Quantity display */}
        <span className="text-brand-500 dark:text-brand-400 text-3xl font-black tracking-tight self-center">
          x{order.quantity}
        </span>
      </div>

      {/* <div className="flex justify-end mt-1">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          className="bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs py-2 px-3.5 rounded-full flex items-center gap-1.5 shadow-sm shadow-brand-500/10 hover:shadow active:scale-95 transition-all duration-150"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          준비 완료
        </button>
      </div> */}
    </article>
  );
}
