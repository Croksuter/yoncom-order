import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import OrderPaymentModal from "./order.payment.modal";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";
import { isPaymentInstructionOrder, isPaymentPaid } from "~/lib/order-status";
import { runWithBlockingLoading } from "~/lib/blocking-loading";
import * as ClientTableResponse from "shared/types/responses/client/table";

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
        <DialogContent className="w-[96%] border-blue-500 border-2 rounded-xl min-h-[200px] flex flex-col justify-center">
          {!hasOrder ? (
            <DialogHeader className="py-8 text-center space-y-2">
              <DialogTitle className="text-xl font-bold text-muted-foreground">결제 안내를 확인할 수 없습니다</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">주문 내역을 다시 확인해주세요.</DialogDescription>
            </DialogHeader>
          ) : (
            <>
              <DialogHeader className="fc items-center my-4">
                <DialogTitle className="sr-only">입금 안내</DialogTitle>
                <div className="fr w-full justify-start !-mt-4">
                  <Button
                    variant="destructive"
                    className="w-fit h-10 rounded-xl"
                    onClick={handleCancelOrder}
                    disabled={isBusy}
                  >주문 취소</Button>
                </div>
                <span className="text-blue-500 text-2xl font-extrabold text-center z-10 bg-white px-2 w-fit">입금 안내</span>
                <DialogDescription className="fc !-mt-4 rounded-xl p-4 border-2 border-blue-500 *:text-base *:my-2 *:text-black">
                  <span className="text-start">⋅ 주문마다 다른 <b className="dangerTXT">결제코드</b>가 붙어 입금금액이 정해집니다.</span>
                  <span className="text-start">⋅ <b className="dangerTXT">안내된 입금금액 그대로</b> 보내야 자동으로 결제 확인됩니다.</span>
                  <span className="text-start">⋅ 금액을 바꾸거나 원금액으로 보내면 운영자가 확인한 뒤 처리될 수 있습니다.</span>
                  <span className="text-start">⋅ 입금 확인 전까지 같은 테이블에서 추가 주문은 잠시 제한됩니다.</span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="fr *:flex-1 *:mx-2 *:h-14 *:rounded-2xl *:text-lg *:my-2">
                <Button variant="outline" onClick={handleDirectTransfer} disabled={isBusy}>직접 이체</Button>
                <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleTossPayment} disabled={isBusy}>토스 이체</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog >
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
