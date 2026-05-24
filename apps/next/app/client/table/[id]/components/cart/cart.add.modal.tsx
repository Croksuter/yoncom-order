"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, BottomSheetContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import useCartStore from "~/stores/cart.store";
import * as ClientMenuResponse from "shared/types/responses/client/menu";
import { MinusIcon, PlusIcon } from "lucide-react";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";
import { useValidateOrder } from "~/hooks/validate-order";
import { isUnresolvedPaymentOrder } from "~/lib/order-status";
import { runWithBlockingLoading } from "~/lib/blocking-loading";

export default function CartAddModal({
  menu,
  openState, setOpenState,
}: {
  menu: ClientMenuResponse.Get["result"][number]["menus"][number];
  openState: boolean;
  setOpenState: any;
}) {
  const [quantity, setQuantity] = useState<number>(1);
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);

  const { addMenuOrder, removeMenuOrder, updateMenuOrder, menuOrders } = useCartStore();
  const { clientTable } = useTableStore();
  const validateOrder = useValidateOrder();

  const recentOrderedQuantity = menuOrders.find((m) => m.menuId === menu.id)?.quantity ?? 0;
  const maxQuantity = menu.quantity;

  // Recover quantity from cart when modal opens
  useEffect(() => {
    if (openState) {
      setQuantity(recentOrderedQuantity > 0 ? recentOrderedQuantity : 1);
      setInvalid(false);
    }
  }, [openState, recentOrderedQuantity]);

  const handleConfirm = async () => {
    if (duringConfirm) return;
    if (quantity < 0 || quantity > maxQuantity || (quantity === 0 && recentOrderedQuantity === 0)) {
      setInvalid(true);
      return;
    }

    const inProgressOrder = clientTable?.tableContexts.some((tableContext) => tableContext.orders.some((order) => (
      isUnresolvedPaymentOrder(order)
    )));
    if (inProgressOrder) {
      toast({
        title: "입금 확인 전 주문이 있습니다.",
        description: "입금 안내를 확인하고 결제 완료 후 추가 주문해주세요.",
        variant: "destructive",
      });
      handleClose();
      return;
    }

    setDuringConfirm(true);
    setInvalid(false);
    setOpenState(false);
    try {
      await runWithBlockingLoading(async () => {
        // Validate with the absolute target quantity
        const isValid = await validateOrder([{ menuId: menu.id, quantity }]);
        if (!isValid) {
          setOpenState(true);
          return;
        }

        // Apply cart updates
        if (recentOrderedQuantity > 0) {
          if (quantity === 0) {
            removeMenuOrder(menu.id);
            toast({
              title: "장바구니에서 메뉴를 제외했습니다.",
            });
          } else {
            updateMenuOrder(menu.id, { menuId: menu.id, quantity });
          }
        } else {
          if (quantity > 0) {
            addMenuOrder({ menuId: menu.id, quantity });
          }
        }
      });
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleClose = () => {
    if (duringConfirm) return;
    setInvalid(false);
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <BottomSheetContent className="fc justify-between max-h-[85vh] overflow-y-auto no-scrollbar">
        {/* Drag Handle */}
        <div className="w-full flex justify-center pb-4">
          <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>

        {/* Hero Image */}
        <div className="w-full h-56 rounded-2xl overflow-hidden relative shadow-sm mb-6 bg-slate-50 dark:bg-slate-800">
          <img
            src={menu.image || "/favicon.ico"}
            alt={menu.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content Details */}
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex justify-between items-start gap-4">
            <h2 className="font-extrabold text-xl text-slate-800 dark:text-slate-100 leading-snug">
              {menu.name}
            </h2>
            <span className="font-extrabold text-lg text-primary dark:text-brand-400 shrink-0">
              ₩ {menu.price.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
            {menu.description || "엄선된 신선한 재료로 준비한 홈런포차 대표 추천 메뉴입니다. 지금 주문해 보세요."}
          </p>
        </div>

        {/* Quantity Adjuster */}
        <div className="fc items-center justify-center space-y-3 mb-6 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-900/50">
          <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            수량 선택
          </div>
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full p-1.5 shadow-sm min-w-[150px]">
            <Button
              onClick={() => quantity > 0 && setQuantity(quantity - 1)}
              className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 p-0 flex items-center justify-center"
              variant="ghost"
              disabled={quantity <= 0 || duringConfirm}
            >
              <MinusIcon className="h-4 w-4 stroke-[3px]" />
            </Button>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 w-10 text-center">
              {quantity}
            </span>
            <Button
              onClick={() => quantity < maxQuantity && setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 p-0 flex items-center justify-center"
              variant="ghost"
              disabled={quantity >= maxQuantity || duringConfirm}
            >
              <PlusIcon className="h-4 w-4 stroke-[3px]" />
            </Button>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            주문 가능 수량: <span className="font-bold text-slate-700 dark:text-slate-300">{maxQuantity}개</span>
          </div>
        </div>

        {invalid && (
          <p className="text-center text-xs text-destructive dark:text-rose-500 font-bold mb-4">
            ⚠︎ 올바른 수량을 입력하세요.
          </p>
        )}

        {/* Bottom CTA Button */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={duringConfirm}
            className="flex-1 py-4 h-auto rounded-xl border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={duringConfirm}
            className="flex-[2] py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer flex justify-center items-center gap-2"
          >
            <span>
              {recentOrderedQuantity > 0
                ? (quantity === 0 ? "장바구니에서 빼기" : "수정 완료")
                : "장바구니 담기"}
            </span>
            <span className="font-medium opacity-85 border-l border-white/20 pl-2 ml-1">
              ₩ {(quantity * menu.price).toLocaleString()}
            </span>
          </Button>
        </div>
      </BottomSheetContent>
    </Dialog>
  );
}
