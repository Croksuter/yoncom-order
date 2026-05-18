import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import useTableStore from "~/stores/table.store";

export default function OrderCancelModal({
  openState, setOpenState,
  order,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  order: AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number];
}) {
  const handleConfirm = async () => {
    await useTableStore.getState().adminCancelOrder({
      orderId: order.id,
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
            <DialogDescription>정말 주문을 취소하시겠습니까?</DialogDescription>
            <DialogDescription>환불은 자동으로 진행되지 않습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="w-full h-fit fr justify-end items-end">
            <div className="w-fit *:h-12 *:rounded-2xl *:text-lg">
              <Button className="mx-1 w-[6rem]" variant="outline" onClick={handleClose}>닫기</Button>
              <Button className="mx-1 w-[6rem] dangerBG dangerB" onClick={handleConfirm}>주문 취소</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}