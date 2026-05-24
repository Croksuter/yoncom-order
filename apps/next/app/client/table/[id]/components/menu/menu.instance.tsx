"use client";

import * as ClientMenuResponse from "shared/types/responses/client/menu";
import { useState } from "react";
import CartAddModal from "../cart/cart.add.modal";
import useMenuStore from "~/stores/menu.store";
import { toast } from "~/hooks/use-toast";
import { Plus } from "lucide-react";

export default function MenuInstance({ menu }: { menu: ClientMenuResponse.Get["result"][number]["menus"][number] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const isSoldOut = menu.quantity <= 0 || !menu.available;

  const handleOpenMenu = async () => {
    if (isOpening || isSoldOut) return;

    setIsOpening(true);
    try {
      const res = await useMenuStore.getState().clientLoad({});
      if (!res) {
        toast({
          title: "메뉴 정보를 불러오는데 실패했습니다.",
          description: "다시 시도해주세요.",
          variant: "destructive",
        });
        return;
      }
      const updatedMenuCategories = useMenuStore.getState().clientMenuCategories;
      const updatedMenuState = updatedMenuCategories?.flatMap((m) => m.menus).find((m) => m.id === menu.id);
      if (!updatedMenuState?.available || updatedMenuState.quantity <= 0) {
        toast({
          title: "메뉴가 품절 또는 비활성화 되었습니다.",
          description: "다른 메뉴를 주문해주세요.",
          variant: "destructive",
        });
        return;
      }
      setModalOpen(true);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <>
      <article
        onClick={handleOpenMenu}
        className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-[0_4px_12px_rgba(19,27,46,0.03)] overflow-hidden flex flex-row h-24 rounded-2xl relative smooth-transition group ${
          isSoldOut 
            ? "opacity-60 saturate-[0.1] cursor-not-allowed" 
            : isOpening 
              ? "pointer-events-none opacity-80 cursor-wait" 
              : "hover:shadow-[0_8px_20px_rgba(19,27,46,0.06)] hover:border-slate-200/80 cursor-pointer active:scale-[0.99]"
        }`}
      >
        {/* Menu Image */}
        <div className="w-24 h-full relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
          <img
            alt={menu.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            src={menu.image ? menu.image : "/favicon.ico"}
          />
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-white text-xs font-black tracking-widest border border-white/50 px-2 py-0.5 rounded-md bg-black/25">
                품절
              </span>
            </div>
          )}
        </div>

        {/* Menu Details */}
        <div className="p-3 flex flex-col flex-grow min-w-0 justify-between">
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate">
              {menu.name}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-1 leading-normal font-medium">
              {menu.description || "맛있는 홈런포차 대표 메뉴입니다."}
            </p>
          </div>
          
          <div className="flex justify-between items-center mt-auto">
            <span className="font-extrabold text-sm text-primary dark:text-brand-400">
              ₩ {menu.price.toLocaleString()}
            </span>
            {!isSoldOut && (
              <button
                aria-label="Add to order"
                className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-primary dark:text-brand-400 flex items-center justify-center transition-all duration-200 hover:bg-primary hover:text-white active:scale-90"
              >
                <Plus className="h-4 w-4 stroke-[3px]" />
              </button>
            )}
          </div>
        </div>
      </article>

      {!isSoldOut && (
        <CartAddModal
          menu={menu}
          openState={modalOpen}
          setOpenState={setModalOpen}
        />
      )}
    </>
  );
}

