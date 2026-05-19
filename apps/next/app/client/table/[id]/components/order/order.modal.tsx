
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import OrderPaymentModal from "./order.payment.modal";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";

export default function OrderModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const [orderPaymentModalOpen, setOrderPaymentModalOpen] = useState(false);
  const { clientTable } = useTableStore();
  const { clientMenuCategories } = useMenuStore();

  const menus = clientMenuCategories!.flatMap((menuCategory) => menuCategory.menus);
  const order = clientTable?.tableContexts[0]?.orders[0];
  const menuOrders = order?.menuOrders;
  if (!menuOrders || !order) return;

  const calculatedAmount = menuOrders.reduce((acc, menuOrder) => {
    return acc + menus.find((menu) => menu.id === menuOrder.menuId)!.price * menuOrder.quantity;
  }, 0);
  const originalAmount = order.payment.originalAmount ?? calculatedAmount;
  const expectedTransferAmount = order.payment.expectedTransferAmount ?? order.payment.amount;
  const paymentCode = order.payment.paymentCode ?? null;
  const expiresAt = typeof order.payment.expiresAt === "number" ? order.payment.expiresAt : null;

  const handleTossPayment = async () => {
    const success = await useTableStore.getState().clientGetTable({
      tableId: clientTable!.id,
    });
    if (!success) {
      toast({
        title: "테이블 정보를 불러오는데 실패했습니다.",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }
    const latestOrder = success.result.tableContexts[0]?.orders[0];
    if (!latestOrder || latestOrder.payment.paid) {
      toast({
        title: "결제 안내가 종료되었습니다.",
        description: latestOrder?.payment.paid ? "이미 결제 완료된 주문입니다." : "확인할 주문이 없습니다.",
      });
      handleClose();
      return;
    }

    const transferAmount = latestOrder.payment.expectedTransferAmount ?? latestOrder.payment.amount;
    window.open(`supertoss://send?amount=${transferAmount}&bank=국민은행&accountNo=94580201548620`, "_blank");
    handleClose();
  }

  const handleDirectTransfer = async () => {
    const success = await useTableStore.getState().clientGetTable({
      tableId: clientTable!.id,
    });
    if (!success) {
      toast({
        title: "테이블 정보를 불러오는데 실패했습니다.",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }
    const latestOrder = success.result.tableContexts[0]?.orders[0];
    if (!latestOrder || latestOrder.payment.paid) {
      toast({
        title: "결제 안내가 종료되었습니다.",
        description: latestOrder?.payment.paid ? "이미 결제 완료된 주문입니다." : "확인할 주문이 없습니다.",
      });
      handleClose();
      return;
    }
    setOrderPaymentModalOpen(true);
    handleClose();
  }

  const handleCancelOrder = async () => {
    const success = await useTableStore.getState().clientGetTable({
      tableId: clientTable!.id,
    });
    if (!success) {
      toast({
        title: "테이블 정보를 불러오는데 실패했습니다.",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }
    const latestOrder = success.result.tableContexts[0]?.orders[0];
    if (!latestOrder || latestOrder.payment.paid) {
      toast({
        title: "주문을 취소할 수 없습니다.",
        description: latestOrder?.payment.paid ? "이미 결제 완료된 주문은 운영자에게 문의해주세요." : "취소할 주문이 없습니다.",
      });
      handleClose();
      return;
    }

    await useTableStore.getState().clientCancelOrder({
      orderId: latestOrder.id,
    });

    setOpenState(false);
  }

  const handleClose = () => {
    setOpenState(false);
  }

  return (
    <>
      <Dialog open={openState} onOpenChange={handleClose}>
        <DialogContent className="w-[96%] border-blue-500 border-2 rounded-xl">
          <DialogHeader className="fc items-center my-4">
            <DialogTitle />
            <div className="fr w-full justify-start !-mt-4">
              <Button
                variant="destructive"
                className="w-fit h-10 rounded-xl"
                onClick={handleCancelOrder}
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
            <Button variant="outline" onClick={handleDirectTransfer}>직접 이체</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleTossPayment}>토스 이체</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
      <OrderPaymentModal
        openState={orderPaymentModalOpen}
        setOpenState={setOrderPaymentModalOpen}
        originalAmount={originalAmount}
        paymentCode={paymentCode}
        expectedTransferAmount={expectedTransferAmount}
        expiresAt={expiresAt}
      />
    </>
  );
}
