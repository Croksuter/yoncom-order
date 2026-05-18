
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
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
  const menuOrders = clientTable?.tableContexts[0]?.orders[0]?.menuOrders;
  if (!menuOrders) return;

  const amount = menuOrders.reduce((acc, menuOrder) => {
    return acc + menus.find((menu) => menu.id === menuOrder.menuId)!.price * menuOrder.quantity;
  }, 0);
  const amountWithKey = amount - clientTable!.key;

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
        title: "주문이 이미 완료되었습니다.",
      });
      handleClose();
      return;
    }

    // TODO: 토스 이체 계좌 변경 필요
    // window.open(`supertoss://send?amount=${amountWithKey}&bank=국민은행&accountNo=11110204273566`, "_blank");
    // window.open(`supertoss://send?amount=${amountWithKey}&bank=국민은행&accountNo=94320201650240`, "_blank");
    window.open(`supertoss://send?amount=${amountWithKey}&bank=국민은행&accountNo=94580201548620`, "_blank");
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
        title: "주문이 이미 완료되었습니다.",
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
        title: "주문이 이미 완료되었습니다.",
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
            <span className="text-blue-500 text-2xl font-extrabold text-center z-10 bg-white px-2 w-fit">꼭! 지켜주세요</span>
            <DialogDescription className="fc !-mt-4 rounded-xl p-4 border-2 border-blue-500 *:text-base *:my-2 *:text-black">
              <span className="text-start">⋅ 송금액의 끝자리가 0이 아닐 수 있습니다. 정상적인 현상이니 <b className="dangerTXT">금액을 절대 변경하지 말고</b> 입금해주세요.</span>
              <span className="text-start">⋅ 주문이 완료되면, <b className="dangerTXT">입금 전까지 추가 주문이 불가합니다.</b></span>
              <span className="text-start">⋅ 입금이 인식되기까지 약 10초 정도 소요됩니다.</span>
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
        amount={amountWithKey}
      />
    </>
  );
}