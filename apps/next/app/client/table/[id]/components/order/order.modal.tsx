"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, BottomSheetContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";
import { isPaymentInstructionOrder } from "~/lib/order-status";
import { runWithBlockingLoading } from "~/lib/blocking-loading";
import { useTranslation } from "~/hooks/use-translation";
import { AlertTriangle } from "lucide-react";

export default function OrderModal({
  openState,
  setOpenState,
  onVerify,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  onVerify?: () => void;
}) {
  const [amountInput, setAmountInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const { clientTable } = useTableStore();
  const { clientMenuCategories } = useMenuStore();
  const { t } = useTranslation();

  const menus = clientMenuCategories ? clientMenuCategories.flatMap((menuCategory) => menuCategory.menus) : [];
  const order = clientTable?.tableContexts[0]?.orders.find(isPaymentInstructionOrder);
  const menuOrders = order?.menuOrders ?? [];
  const hasOrder = !!order && menuOrders.length > 0;

  const expectedTransferAmount = order ? (order.payment.expectedTransferAmount ?? order.payment.amount ?? 0) : 0;
  const originalAmount = order ? (order.payment.originalAmount ?? expectedTransferAmount) : 0;
  const paymentCode = order ? (order.payment.paymentCode ?? null) : null;

  const isMatch = amountInput.trim() !== "" && parseInt(amountInput.trim(), 10) === expectedTransferAmount;

  const clearTableContextIfLastOrder = () => {
    const activeContext = clientTable?.tableContexts[0];
    if (!clientTable || !activeContext || activeContext.orders.filter((candidate) => candidate.deletedAt === null).length > 1) {
      return false;
    }

    useTableStore.setState({
      clientTable: {
        ...clientTable,
        tableContexts: [],
      },
      isLoaded: true,
      error: false,
    });
    void useMenuStore.getState().clientLoad({});
    return true;
  };

  const handleCancelOrder = async () => {
    if (isBusy || !order) return;
    setIsBusy(true);

    try {
      await runWithBlockingLoading(async () => {
        const cancelled = await useTableStore.getState().clientCancelOrder({
          orderId: order.id,
        });
        if (!cancelled) {
          toast({
            title: t("order_cancel_failed"),
            description: t("order_cancel_failed_desc"),
            variant: "destructive",
          });
          return;
        }

        if (clearTableContextIfLastOrder()) {
          setOpenState(false);
          return;
        }

        if (clientTable?.id) {
          await useTableStore.getState().clientGetTable({ tableId: clientTable.id });
        }
        setOpenState(false);
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmVerification = () => {
    if (!order) return;
    localStorage.setItem(`verified_order_${order.id}`, "true");
    if (onVerify) {
      onVerify();
    }
    setOpenState(false);
  };

  return (
    <Dialog open={openState} onOpenChange={() => {}}>
      <BottomSheetContent
        hideClose={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="fc justify-between max-h-[85vh] overflow-y-auto no-scrollbar"
      >
        {!hasOrder ? (
          <div className="fc items-center justify-center py-12 text-center space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full text-slate-400 dark:text-slate-300">
              <AlertTriangle className="h-10 w-10 text-amber-500 animate-bounce" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                {t("order_pay_info_unavailable")}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {t("order_pay_info_unavailable_desc")}
              </DialogDescription>
            </div>
            <Button
              onClick={() => setOpenState(false)}
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
                {t("order_complete_confirm")}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium leading-relaxed">
                {t("order_transfer_guideline")}
              </DialogDescription>
            </div>

            {/* Breakdown Box */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col gap-3 font-semibold text-sm mb-4">
              <div className="flex justify-between items-center text-slate-500">
                <span>{t("order_amount")}</span>
                <span>₩ {originalAmount.toLocaleString()}</span>
              </div>
              {paymentCode !== null && paymentCode > 0 && (
                <div className="flex justify-between items-center text-red-500">
                  <span>{t("order_discount")}</span>
                  <span>- ₩ {paymentCode.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
              <div className="flex justify-between items-center text-slate-800 dark:text-slate-100 font-extrabold text-base">
                <span>{t("order_final_amount")}</span>
                <span className="text-primary dark:text-brand-600 text-lg">₩ {expectedTransferAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Input field */}
            <div className="space-y-2 mb-6">
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider pl-1">
                {t("pay_exact_amount")}
              </label>
              <Input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder={t("order_input_transfer_placeholder")}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9]/g, ""))}
                className={`py-6 px-4 rounded-xl border font-extrabold text-lg transition-all duration-250 ${
                  amountInput === ""
                    ? "border-slate-200 dark:border-slate-800 focus:border-primary"
                    : isMatch
                      ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50/10 text-emerald-600 dark:text-emerald-400"
                      : "border-destructive focus:border-destructive bg-destructive/5 text-destructive"
                }`}
              />
              {amountInput !== "" && !isMatch && (
                <p className="text-[11px] font-bold text-destructive pl-1 animate-pulse">
                  {t("order_amount_mismatch")}
                </p>
              )}
              {isMatch && (
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pl-1">
                  {t("order_amount_match")}
                </p>
              )}
            </div>

            {/* CTA Footer */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancelOrder}
                disabled={isBusy}
                className="flex-1 py-4 h-auto rounded-xl border-destructive/20 text-destructive dark:text-rose-500 hover:bg-destructive/5 dark:hover:bg-rose-950/25 font-bold cursor-pointer transition-colors"
              >
                {t("order_cancel_btn")}
              </Button>
              <Button
                disabled={!isMatch || isBusy}
                onClick={handleConfirmVerification}
                className="flex-[2] py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("order_confirm_btn")}
              </Button>
            </div>
          </>
        )}
      </BottomSheetContent>
    </Dialog>
  );
}
