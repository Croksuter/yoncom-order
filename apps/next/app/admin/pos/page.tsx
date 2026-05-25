"use client";

import { useState } from "react";
import Inventories from "./components/inventory/inventories";
import Orders from "./components/order/orders";
import Tables from "./components/table/tables";
import { traceEvent } from "~/lib/verification-trace";
import { 
  ChevronLeft, 
  ChevronRight, 
  Package
} from "lucide-react";

export default function AdminPosPage() {
  const [isInventoriesOpen, setIsInventoriesOpen] = useState(true);

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
    <div className="flex-1 overflow-y-auto lg:overflow-hidden p-2 flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 relative transition-colors duration-300 animate-fade-in">
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
  );
}
