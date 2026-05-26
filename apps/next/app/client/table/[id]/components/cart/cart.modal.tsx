import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, BottomSheetContent } from "~/components/ui/dialog";
import useCartStore, { CartState } from "~/stores/cart.store";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";
import { useValidateOrder } from "~/hooks/validate-order";
import { runWithBlockingLoading } from "~/lib/blocking-loading";
import { isPaymentInstructionOrder } from "~/lib/order-status";
import { useTranslation } from "~/hooks/use-translation";
import { MinusIcon, PlusIcon, ArrowRight, ShoppingCart } from "lucide-react";

type MenuOrderInfo = {
  menuId: CartState["menuOrders"][number]["menuId"];
  menuName: string;
  menuPrice: number;
  quantity: CartState["menuOrders"][number]["quantity"];
  totalPrice: number;
} | null;

export default function CartModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const [startVisitConfirmOpen, setStartVisitConfirmOpen] = useState(false);
  const [duringPurchase, setDuringPurchase] = useState(false);
  const [checkoutMenuOrderInfos, setCheckoutMenuOrderInfos] = useState<MenuOrderInfo[] | null>(null);

  const { clientMenuCategories } = useMenuStore();
  const { menuOrders, purchaseMenuOrders } = useCartStore();
  const { clientTable } = useTableStore();
  const validateOrder = useValidateOrder();
  const { t, language } = useTranslation();

  const menus = clientMenuCategories?.flatMap((menuCategory) => menuCategory.menus) ?? [];
  const menuOrderInfos: MenuOrderInfo[] = menuOrders.map((menuOrder) => {
    const menu = menus.find((menu) => menu.id === menuOrder.menuId);
    if (!menu) return null;
    return {
      menuId: menuOrder.menuId,
      menuName: language === "en" && menu.nameEn ? menu.nameEn : menu.name,
      menuPrice: menu.price,
      quantity: menuOrder.quantity,
      totalPrice: menu.price * menuOrder.quantity,
    }
  })
  const visibleMenuOrderInfos = checkoutMenuOrderInfos ?? menuOrderInfos;

  const noMenuOrder = visibleMenuOrderInfos.length === 0;
  const invalidMenuOrder = visibleMenuOrderInfos.length === 0 || visibleMenuOrderInfos.some((menuOrderInfo) => menuOrderInfo === null)
  const isInactiveTable = clientTable?.tableContexts.length === 0;

  const submitOrder = async (startNewTableSession: boolean) => {
    if (duringPurchase) return;
    setDuringPurchase(true);
    setCheckoutMenuOrderInfos(menuOrderInfos);
    setOpenState(false);

    const restoreCartModal = () => {
      setCheckoutMenuOrderInfos(null);
      setOpenState(true);
    };

    try {
      await runWithBlockingLoading(async () => {
        const isValid = await validateOrder(menuOrders);
        if (!isValid) {
          restoreCartModal();
          return;
        }

        const res = await purchaseMenuOrders({ startNewTableSession });
        if (res === null) {
          restoreCartModal();
          return;
        }

        const tableResponse = await useTableStore.getState().clientGetTable({
          tableId: clientTable!.id,
        });
        if (!tableResponse) {
          restoreCartModal();
          return;
        }

        const latestPaymentOrder = tableResponse.result.tableContexts[0]?.orders.find(isPaymentInstructionOrder);
        if (!latestPaymentOrder) {
          toast({
            title: t("order_pay_info_unavailable"),
            description: t("order_pay_info_unavailable_desc"),
            variant: "destructive",
          });
          restoreCartModal();
          return;
        }

        useCartStore.getState().clearMenuOrders();
        setCheckoutMenuOrderInfos(null);
      });
    } finally {
      setDuringPurchase(false);
      if (!useCartStore.getState().menuOrders.length) {
        setCheckoutMenuOrderInfos(null);
      }
    }
  }

  const handleConfirm = async () => {
    if (isInactiveTable) {
      setOpenState(false);
      setStartVisitConfirmOpen(true);
      return;
    }

    await submitOrder(false);
  }

  const handleClose = () => {
    if (!duringPurchase) {
      setCheckoutMenuOrderInfos(null);
    }
    setOpenState(false);
  }

  const updateQuantity = (menuId: string, delta: number) => {
    const currentOrder = menuOrders.find((order) => order.menuId === menuId);
    if (!currentOrder) return;
    const targetMenu = menus.find((m) => m.id === menuId);
    if (!targetMenu) return;

    const newQuantity = currentOrder.quantity + delta;
    if (newQuantity <= 0) {
      useCartStore.getState().removeMenuOrder(menuId);
    } else if (newQuantity <= targetMenu.quantity) {
      useCartStore.getState().updateMenuOrder(menuId, {
        menuId,
        quantity: newQuantity,
      });
    } else {
      toast({
        title: t("cart_max_qty_toast", { qty: targetMenu.quantity }),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={openState} onOpenChange={handleClose}>
        <BottomSheetContent className="fc justify-between max-h-[85vh]">
          {noMenuOrder || invalidMenuOrder ? (
            <div className="fc items-center justify-center py-12 text-center space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full text-slate-400 dark:text-slate-300">
                <ShoppingCart className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                  {t("cart_empty")}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  {t("cart_empty_desc")}
                </DialogDescription>
              </div>
              <Button
                onClick={handleClose}
                className="mt-4 px-6 py-2.5 rounded-full bg-primary hover:bg-brand-600 text-white font-bold text-xs"
              >
                {t("cart_go_to_menu")}
              </Button>
            </div>
          ) : (
            <>
              {/* Drag Handle */}
              <div className="w-full flex justify-center pb-4">
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
              </div>

              {/* Header */}
              <div className="space-y-1 text-center mb-4">
                <DialogTitle className="text-2xl font-black text-slate-800 dark:text-slate-100">
                  {t("cart_title")}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-medium">
                  {t("cart_confirm_qty")}
                </DialogDescription>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 my-2 pr-1 max-h-[45vh]">
                {visibleMenuOrderInfos.map((menuOrderInfo) => {
                  const menuObj = menus.find((m) => m.id === menuOrderInfo!.menuId);
                  return (
                    <div key={menuOrderInfo!.menuId} className="fc">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img
                            src={menuObj?.image || "/favicon.ico"}
                            alt={menuOrderInfo!.menuName}
                            className="w-14 h-14 rounded-xl object-cover shadow-sm bg-slate-100 dark:bg-slate-800"
                          />
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate">
                              {menuOrderInfo!.menuName}
                            </h3>
                            <p className="text-xs text-slate-400 dark:text-slate-300 font-bold mt-0.5">
                              ₩ {menuOrderInfo!.menuPrice.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Interactive Counter Pill */}
                        <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-full p-1 shadow-sm">
                          <button
                            onClick={() => updateQuantity(menuOrderInfo!.menuId, -1)}
                            disabled={duringPurchase}
                            className="text-slate-500 hover:text-primary hover:bg-white dark:hover:bg-slate-700 p-1 rounded-full transition-all active:scale-90"
                          >
                            <MinusIcon className="h-3.5 w-3.5 stroke-[3px]" />
                          </button>
                          <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 w-6 text-center">
                            {menuOrderInfo!.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(menuOrderInfo!.menuId, 1)}
                            disabled={duringPurchase}
                            className="text-slate-500 hover:text-primary hover:bg-white dark:hover:bg-slate-700 p-1 rounded-full transition-all active:scale-90"
                          >
                            <PlusIcon className="h-3.5 w-3.5 stroke-[3px]" />
                          </button>
                        </div>
                      </div>
                      <div className="h-px bg-slate-100 dark:bg-slate-800/60 w-full mt-4"></div>
                    </div>
                  );
                })}
              </div>

              {/* Total Summary Row */}
              <div className="flex justify-between items-center py-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                <span className="text-sm text-slate-400 dark:text-slate-300 font-bold">{t("cart_total_price")}</span>
                <span className="text-2xl font-black text-primary dark:text-brand-700">
                  ₩ {visibleMenuOrderInfos.reduce((acc, item) => acc + item!.totalPrice, 0).toLocaleString()}
                </span>
              </div>

              {/* Actions Footer */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={duringPurchase}
                  className="flex-1 py-4 h-auto rounded-xl border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                >
                  {t("cart_add_more")}
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={duringPurchase}
                  className="flex-[2] py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer flex justify-center items-center gap-2"
                >
                  <span>{t("cart_complete_order_btn")}</span>
                  <ArrowRight className="h-4 w-4 stroke-[3px]" />
                </Button>
              </div>
            </>
          )}
        </BottomSheetContent>
      </Dialog>
      <Dialog open={startVisitConfirmOpen} onOpenChange={setStartVisitConfirmOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl">
          <div className="space-y-3 text-center">
            <DialogTitle className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
              {t("cart_new_customer_title")}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {t("cart_new_customer_desc")}
            </DialogDescription>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setStartVisitConfirmOpen(false);
                setOpenState(true);
              }}
              disabled={duringPurchase}
              className="flex-1 h-12 rounded-xl font-bold"
            >
              {t("cart_check_more")}
            </Button>
            <Button
              onClick={() => {
                setStartVisitConfirmOpen(false);
                void submitOrder(true);
              }}
              disabled={duringPurchase}
              className="flex-[2] h-12 rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold"
            >
              {t("cart_start_btn")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
