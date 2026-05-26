import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogTitle, BottomSheetContent } from "~/components/ui/dialog";
import useMenuStore from "~/stores/menu.store";
import * as ClientTableResponse from "shared/types/responses/client/table";
import { getMenuOrderStatusLabel, getPaymentStatusLabel } from "~/lib/order-status";
import { useTranslation } from "~/hooks/use-translation";
import { getStatusTranslationKey } from "~/lib/i18n/status-translator";
import { Receipt, Calendar, Info } from "lucide-react";

export default function OrderDetailModal({
  openState, setOpenState,
  orderDetail,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  orderDetail: ClientTableResponse.Get["result"]["tableContexts"][number]["orders"][number] | null;
}) {
  const { menus } = useMenuStore();
  const { t, language } = useTranslation();

  if (!orderDetail) return null;

  const menuOrderInfos = orderDetail.menuOrders.map((menuOrder) => {
    const menu = menus.find((m) => m.id === menuOrder.menuId);
    if (!menu) return null;
    return {
      menuId: menuOrder.menuId,
      menuName: language === "en" && menu.nameEn ? menu.nameEn : menu.name,
      menuPrice: menu.price,
      quantity: menuOrder.quantity,
      totalPrice: menu.price * menuOrder.quantity,
    };
  });
  const originalAmount = orderDetail.payment.originalAmount ?? orderDetail.payment.amount;
  const expectedTransferAmount = orderDetail.payment.expectedTransferAmount ?? orderDetail.payment.amount;

  const handleClose = () => {
    setOpenState(false);
  };

  const isRefunded = orderDetail.payment.status === "REFUNDED";
  const isRefundPending = orderDetail.payment.status === "REFUND_PENDING";

  return (
    <>
      <Dialog open={openState} onOpenChange={setOpenState}>
        <BottomSheetContent className="fc justify-between max-h-[85vh] overflow-y-auto no-scrollbar">
          <>
            {/* Drag Handle */}
            <div className="w-full flex justify-center pb-4">
              <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            </div>

            {/* Header */}
            <div className="space-y-1 text-center mb-4">
              <DialogTitle className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5">
                <Receipt className="h-5 w-5 text-primary" />
                {t("order_detail_title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-bold flex items-center justify-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(orderDetail.createdAt).toLocaleString(language === "ko" ? "ko-KR" : "en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </DialogDescription>
            </div>

            {/* Payment Warning Banners */}
            {isRefundPending && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-500 rounded-xl p-3 flex items-center gap-2 text-xs font-bold mb-4 animate-pulse">
                <Info className="h-4 w-4 shrink-0" />
                <span>{t("order_refund_confirming")}</span>
              </div>
            )}
            {isRefunded && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-xl p-3 flex items-center gap-2 text-xs font-bold mb-4">
                <Info className="h-4 w-4 shrink-0" />
                <span>{t("order_refund_completed")}</span>
              </div>
            )}

            {/* Status Summary Banner */}
            <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex flex-col gap-1 text-xs mb-4">
              <div className="flex justify-between font-bold text-slate-500">
                <span>{t("order_payment_status")}</span>
                <span className="text-primary dark:text-brand-400 font-extrabold">
                  {t(getStatusTranslationKey(getPaymentStatusLabel(orderDetail.payment, orderDetail)) as any)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-500">
                <span>{t("order_payment_code")}</span>
                <span className="text-slate-700 dark:text-slate-300 font-bold">
                  {orderDetail.payment.paymentCode !== null ? `₩ ${orderDetail.payment.paymentCode.toLocaleString()}` : "-"}
                </span>
              </div>
            </div>

            {/* Receipt Item List */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 my-2 pr-1 max-h-[35vh]">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest pl-1">
                {t("order_items_list")}
              </div>
              <div className="border border-slate-100 dark:border-slate-850 rounded-2xl p-4 bg-slate-50/20 dark:bg-slate-950/10 space-y-3">
                {menuOrderInfos.map((menuOrderInfo) => {
                  const menuOrder = orderDetail.menuOrders.find((item) => item.menuId === menuOrderInfo!.menuId);
                  return (
                    <div key={menuOrderInfo!.menuId} className="fc">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                            {menuOrderInfo!.menuName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <span>₩ {menuOrderInfo!.menuPrice.toLocaleString()}</span>
                            <span>×</span>
                            <span className="font-bold text-slate-600 dark:text-slate-300">{menuOrderInfo!.quantity}{t("order_history_item_unit")}</span>
                          </div>
                        </div>

                        <div className="fc items-end shrink-0">
                          <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                            ₩ {menuOrderInfo!.totalPrice.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-primary dark:text-brand-400 mt-0.5">
                            {menuOrder ? t(getStatusTranslationKey(getMenuOrderStatusLabel(menuOrder, orderDetail)) as any) : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Row */}
            <div className="flex justify-between items-center py-4 border-t border-slate-100 dark:border-slate-800 mt-2">
              <span className="text-sm text-slate-400 dark:text-slate-300 font-bold">{t("order_final_price")}</span>
              <span className="text-2xl font-black text-primary dark:text-brand-400">
                ₩ {expectedTransferAmount.toLocaleString()}
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
        </BottomSheetContent>
      </Dialog>
    </>
  );
}

