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
            title: "주문 취소에 실패했습니다.",
            description: "직원에게 문의해 주세요.",
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
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full text-slate-400 dark:text-slate-500">
              <AlertTriangle className="h-10 w-10 text-amber-500 animate-bounce" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                결제 안내를 확인할 수 없습니다
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                주문 내역을 다시 확인해 주세요.
              </DialogDescription>
            </div>
            <Button
              onClick={() => setOpenState(false)}
              className="mt-4 px-6 py-2.5 rounded-full bg-primary hover:bg-brand-600 text-white font-bold text-xs"
            >
              닫기
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
                주문 완료 (입금 금액 확인)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium leading-relaxed">
                안전하고 정확한 이체 진행을 위해 아래의 금액 계산식을 보시고<br />
                최종 입금하실 금액을 수동으로 입력해 주세요.
              </DialogDescription>
            </div>

            {/* Breakdown Box */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col gap-3 font-semibold text-sm mb-4">
              <div className="flex justify-between items-center text-slate-500">
                <span>주문금액</span>
                <span>₩ {originalAmount.toLocaleString()}</span>
              </div>
              {paymentCode !== null && paymentCode > 0 && (
                <div className="flex justify-between items-center text-red-500">
                  <span>결제코드 할인</span>
                  <span>- ₩ {paymentCode.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
              <div className="flex justify-between items-center text-slate-800 dark:text-slate-100 font-extrabold text-base">
                <span>최종 입금할 금액</span>
                <span className="text-primary dark:text-brand-400 text-lg">₩ {expectedTransferAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Input field */}
            <div className="space-y-2 mb-6">
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">
                이체 예정인 정확한 금액 입력
              </label>
              <Input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="입금하실 금액을 입력하세요"
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
                  ⚠︎ 계산된 최종 입금금액과 다릅니다. 금액을 다시 확인해 주세요.
                </p>
              )}
              {isMatch && (
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pl-1">
                  ✓ 최종 입금금액과 정확히 일치합니다.
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
                주문 취소
              </Button>
              <Button
                disabled={!isMatch || isBusy}
                onClick={handleConfirmVerification}
                className="flex-[2] py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                확인
              </Button>
            </div>
          </>
        )}
      </BottomSheetContent>
    </Dialog>
  );
}
