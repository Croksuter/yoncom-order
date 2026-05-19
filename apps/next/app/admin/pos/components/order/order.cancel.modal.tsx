import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import useTableStore from "~/stores/table.store";
import { isPaymentPaid } from "~/lib/order-status";

export default function OrderCancelModal({
  openState, setOpenState,
  order,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  order: AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number];
}) {
  const [cancelReason, setCancelReason] = useState("");
  const isPaidActive = isPaymentPaid(order.payment);
  const hasPickedUp = isPaidActive && order.menuOrders.some((menuOrder) => menuOrder.status === "PICKED_UP");

  const handleConfirm = async () => {
    if (isPaidActive && cancelReason.trim().length === 0) {
      return;
    }

    await useTableStore.getState().adminCancelOrder({
      orderId: order.id,
      cancelReason: isPaidActive ? cancelReason.trim() : undefined,
    });
    handleClose();
  }

  const handleClose = () => {
    setOpenState(false);
  }

  return (
    <>
      <Dialog open={openState} onOpenChange={setOpenState}>
        <DialogContent className="fc min-w-fit min-h-[25rem] max-h-[40rem] justify-between rounded-xl">
          <DialogHeader className="fc items-start w-fit">
            <DialogTitle className="text-2xl">주문 취소</DialogTitle>
            <DialogDescription>이 주문을 운영자 취소 처리하시겠습니까?</DialogDescription>
            {isPaidActive && <DialogDescription>결제 완료 주문은 취소 후 환불 대기 상태로 남습니다.</DialogDescription>}
            {hasPickedUp && <DialogDescription>수령 완료된 주문은 시스템에서 취소할 수 없습니다.</DialogDescription>}
          </DialogHeader>
          {isPaidActive && (
            <div className="w-full space-y-1 text-sm">
              <label className="font-semibold" htmlFor="cancel-reason-fallback">취소 사유</label>
              <Input
                id="cancel-reason-fallback"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="예: 고객 요청, 메뉴 품절, 중복 주문"
              />
            </div>
          )}
          <DialogFooter className="w-full h-fit fr justify-end items-end">
            <div className="w-fit *:h-12 *:rounded-2xl *:text-lg">
              <Button className="mx-1 w-[6rem]" variant="outline" onClick={handleClose}>닫기</Button>
              <Button className="mx-1 w-[6rem] dangerBG dangerB" disabled={hasPickedUp || (isPaidActive && cancelReason.trim().length === 0)} onClick={handleConfirm}>주문 취소</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
