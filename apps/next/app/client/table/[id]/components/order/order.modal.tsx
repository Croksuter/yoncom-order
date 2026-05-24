import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, BottomSheetContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import OrderPaymentModal from "./order.payment.modal";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";
import { isPaymentInstructionOrder, isPaymentPaid } from "~/lib/order-status";
import { runWithBlockingLoading } from "~/lib/blocking-loading";
import * as ClientTableResponse from "shared/types/responses/client/table";
import { AlertTriangle, ArrowRight } from "lucide-react";

type ClientOrder = ClientTableResponse.Get["result"]["tableContexts"][number]["orders"][number];

type PaymentSnapshot = {
  originalAmount: number;
  paymentCode: number | null;
  expectedTransferAmount: number;
  expiresAt: number | null;
};

export default function OrderModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const [orderPaymentModalOpen, setOrderPaymentModalOpen] = useState(false);
  const [paymentSnapshot, setPaymentSnapshot] = useState<PaymentSnapshot | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const { clientTable } = useTableStore();
  const { clientMenuCategories } = useMenuStore();

  const menus = clientMenuCategories ? clientMenuCategories.flatMap((menuCategory) => menuCategory.menus) : [];
  const order = clientTable?.tableContexts[0]?.orders.find(isPaymentInstructionOrder);
  const menuOrders = order?.menuOrders ?? [];
  const hasOrder = !!order && menuOrders.length > 0;

  const createPaymentSnapshot = (targetOrder: ClientOrder): PaymentSnapshot => {
    const calculatedAmount = targetOrder.menuOrders.reduce((acc, menuOrder) => {
      const targetMenu = menus.find((menu) => menu.id === menuOrder.menuId);
      return acc + (targetMenu ? targetMenu.price : 0) * menuOrder.quantity;
    }, 0);

    return {
      originalAmount: targetOrder.payment.originalAmount ?? calculatedAmount,
      expectedTransferAmount: targetOrder.payment.expectedTransferAmount ?? targetOrder.payment.amount ?? 0,
      paymentCode: targetOrder.payment.paymentCode ?? null,
      expiresAt: typeof targetOrder.payment.expiresAt === "number" ? targetOrder.payment.expiresAt : null,
    };
  };

  const getLatestPaymentInstructionOrder = async () => {
    if (!clientTable?.id) {
      toast({
        title: "테이블 정보를 불러오는데 실패했습니다.",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
      return null;
    }

    const success = await useTableStore.getState().clientGetTable({
      tableId: clientTable.id,
    });
    if (!success) return null;

    const latestOrder = success.result.tableContexts[0]?.orders.find(isPaymentInstructionOrder);
    if (!latestOrder || isPaymentPaid(latestOrder.payment)) {
      toast({
        title: "결제 안내가 종료되었습니다.",
        description: isPaymentPaid(latestOrder?.payment) ? "이미 결제 완료된 주문입니다." : "확인할 주문이 없습니다.",
      });
      return null;
    }

    return latestOrder;
  };

  const restoreOrderModal = () => {
    setOpenState(true);
  };

  const handleTossPayment = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setOpenState(false);

    try {
      await runWithBlockingLoading(async () => {
        const latestOrder = await getLatestPaymentInstructionOrder();
        if (!latestOrder) {
          restoreOrderModal();
          return;
        }

        const transferAmount = latestOrder.payment.expectedTransferAmount ?? latestOrder.payment.amount;
        window.open(`supertoss://send?amount=${transferAmount}&bank=국민은행&accountNo=94580201548620`, "_blank");
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDirectTransfer = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setOpenState(false);

    try {
      await runWithBlockingLoading(async () => {
        const latestOrder = await getLatestPaymentInstructionOrder();
        if (!latestOrder) {
          restoreOrderModal();
          return;
        }

        setPaymentSnapshot(createPaymentSnapshot(latestOrder));
        setOrderPaymentModalOpen(true);
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelOrder = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setOpenState(false);

    try {
      await runWithBlockingLoading(async () => {
        const latestOrder = await getLatestPaymentInstructionOrder();
        if (!latestOrder) {
          restoreOrderModal();
          return;
        }

        const cancelled = await useTableStore.getState().clientCancelOrder({
          orderId: latestOrder.id,
        });
        if (!cancelled) {
          restoreOrderModal();
          return;
        }

        if (clientTable?.id) {
          await useTableStore.getState().clientGetTable({ tableId: clientTable.id });
        }
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleClose = () => {
    if (isBusy) return;
    setOpenState(false);
  };

  return (
    <>
      <Dialog open={openState} onOpenChange={handleClose}>
        <BottomSheetContent className="fc justify-between max-h-[85vh] overflow-y-auto no-scrollbar">
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
                  주문 내역을 다시 확인해주세요.
                </DialogDescription>
              </div>
              <Button
                onClick={handleClose}
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
                  입금 안내
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-medium">
                  자동 결제 처리를 위해 꼭 확인해 주세요.
                </DialogDescription>
              </div>

              {/* Content Panel */}
              <div className="bg-brand-50/40 dark:bg-brand-950/20 border border-brand-100/50 dark:border-brand-900/30 p-5 rounded-2xl text-slate-700 dark:text-slate-200 text-sm leading-relaxed space-y-3 font-medium mb-6">
                <div className="flex gap-2">
                  <span className="text-primary font-bold">⋅</span>
                  <p>주문마다 다른 <strong className="text-destructive font-black">결제코드</strong>가 부여되어 입금 금액이 결정됩니다.</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary font-bold">⋅</span>
                  <p><strong className="text-destructive font-black">안내된 정확한 입금 금액</strong>을 이체하셔야 자동 결제 처리가 완료됩니다.</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary font-bold">⋅</span>
                  <p>이체 금액을 임의로 변경하시면 직원의 수동 확인이 필요하여 처리가 지연될 수 있습니다.</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary font-bold">⋅</span>
                  <p>이체 대기 및 확인 중 상태일 때는 동일 테이블에서의 추가 주문이 임시 제한됩니다.</p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="fc gap-3">
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
                    variant="outline"
                    onClick={handleDirectTransfer}
                    disabled={isBusy}
                    className="flex-1 py-4 h-auto rounded-xl border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                  >
                    직접 이체
                  </Button>
                </div>
                <Button
                  onClick={handleTossPayment}
                  disabled={isBusy}
                  className="w-full py-4 h-auto rounded-xl bg-primary hover:bg-brand-600 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(0,61,155,0.2)] hover:shadow-[0_12px_28px_rgba(0,61,155,0.3)] transition-all duration-300 active:scale-[0.98] cursor-pointer flex justify-center items-center gap-2"
                >
                  <span>토스 앱으로 간편 송금</span>
                  <ArrowRight className="h-4 w-4 stroke-[3px]" />
                </Button>
              </div>
            </>
          )}
        </BottomSheetContent>
      </Dialog>
      {paymentSnapshot && (
        <OrderPaymentModal
          openState={orderPaymentModalOpen}
          setOpenState={setOrderPaymentModalOpen}
          originalAmount={paymentSnapshot.originalAmount}
          paymentCode={paymentSnapshot.paymentCode}
          expectedTransferAmount={paymentSnapshot.expectedTransferAmount}
          expiresAt={paymentSnapshot.expiresAt}
        />
      )}
    </>
  );
}

