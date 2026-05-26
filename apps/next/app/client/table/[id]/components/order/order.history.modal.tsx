import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, BottomSheetContent } from "~/components/ui/dialog";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import OrderDetailModal from "./order.detail.modal";
import * as ClientTableResponse from "shared/types/responses/client/table";
import { getOrderStatusLabel } from "~/lib/order-status";
import { useTranslation } from "~/hooks/use-translation";
import { getStatusTranslationKey } from "~/lib/i18n/status-translator";
import { History, Receipt, ArrowRight } from "lucide-react";

export default function OrderHistoryModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const [orderDetailModalOpenState, setOrderDetailModalOpenState] = useState(false);
  const [orderDetail, setOrderDetail] = useState<ClientTableResponse.Get["result"]["tableContexts"][number]["orders"][number] | null>(null);

  const { menus } = useMenuStore();
  const { clientTable } = useTableStore();
  const { t, language } = useTranslation();

  const orders = clientTable?.tableContexts[0]?.orders ?? [];
  const orderHistories = orders.map((order) => {
    const menuOrders = order.menuOrders.map((menuOrder) => {
      const menu = menus.find((menu) => menu.id === menuOrder.menuId);
      if (!menu) return null;
      return {
        menuId: menuOrder.menuId,
        menuName: menu.name,
        menuPrice: menu.price,
        quantity: menuOrder.quantity,
        totalPrice: menu.price * menuOrder.quantity,
      };
    }).filter((menuOrder) => menuOrder !== null);

    return {
      orderId: order.id,
      orderDate: order.createdAt,
      menuOrders,
      totalPrice: menuOrders.reduce((acc, menuOrder) => acc + menuOrder.totalPrice, 0),
      payment: order.payment,
      order: order,
    };
  });

  const handleClose = () => {
    setOpenState(false);
  };

  return (
    <>
      <Dialog open={openState} onOpenChange={setOpenState}>
        <BottomSheetContent className="fc justify-between max-h-[85vh]">
          {orderHistories.length === 0 ? (
            <div className="fc items-center justify-center py-12 text-center space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full text-slate-400 dark:text-slate-300">
                <History className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                  {t("order_history_empty")}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  {t("order_history_empty_desc")}
                </DialogDescription>
              </div>
              <Button
                onClick={handleClose}
                className="mt-4 px-6 py-2.5 rounded-full bg-primary hover:bg-brand-600 text-white font-bold text-xs"
              >
                {t("close")}
              </Button>
            </div>
          ) : (
            <>
              {/* Drag Handle */}
              <div className="w-full flex justify-center pb-4">
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
              </div>

              {/* Header */}
              <div className="space-y-1 text-center mb-6">
                <DialogTitle className="text-2xl font-black text-slate-800 dark:text-slate-100">
                  {t("nav_orders")}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-medium">
                  {t("order_history_touch_desc")}
                </DialogDescription>
              </div>

              {/* Order List */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 my-2 pr-1 max-h-[45vh]">
                {orderHistories.map((orderHistory) => {
                  const statusLabel = getOrderStatusLabel(orderHistory.order);
                  const isCancelled = orderHistory.order.deletedAt !== null;
                  const isPaid = orderHistory.order.payment?.status === "PAID";

                  return (
                    <div
                      key={orderHistory.orderId}
                      onClick={() => {
                        setOrderDetail(orderHistory.order);
                        setOrderDetailModalOpenState(true);
                      }}
                      className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      <div className="fc gap-1 min-w-0">
                        <span className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">
                          {new Date(orderHistory.orderDate).toLocaleString(language === "ko" ? "ko-KR" : "en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate">
                            {orderHistory.menuOrders[0]?.menuName}
                            {orderHistory.menuOrders.length > 1 && t("order_history_items_count", { count: orderHistory.menuOrders.length - 1 })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="fc items-end">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${
                            isCancelled
                              ? "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-rose-400"
                              : isPaid
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                          }`}>
                            {t(getStatusTranslationKey(statusLabel) as any)}
                          </span>
                          <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 mt-1">
                            ₩ {orderHistory.totalPrice.toLocaleString()}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Summary Row */}
              <div className="flex justify-between items-center py-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                <span className="text-sm text-slate-400 dark:text-slate-300 font-bold">{t("order_history_accumulated")}</span>
                <span className="text-2xl font-black text-primary dark:text-brand-400">
                  ₩ {orderHistories.filter((oh) => oh.order.deletedAt === null).reduce((acc, oh) => acc + oh.totalPrice, 0).toLocaleString()}
                </span>
              </div>

              {/* Close Button */}
              <Button
                className="w-full py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer"
                onClick={handleClose}
              >
                {t("close")}
              </Button>
            </>
          )}
        </BottomSheetContent>
      </Dialog>
      <OrderDetailModal
        openState={orderDetailModalOpenState}
        setOpenState={setOrderDetailModalOpenState}
        orderDetail={orderDetail}
      />
    </>
  );
}
