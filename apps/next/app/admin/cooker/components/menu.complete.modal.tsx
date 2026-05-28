import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import useTableStore from "~/stores/table.store";

export default function MenuCompleteModal({
  openState, setOpenState,
  menuName,
  tableName,
  menuOrderId,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  menuName: string;
  tableName: string;
  menuOrderId: string;
}) {
  const [duringConfirm, setDuringConfirm] = useState(false);
  const autoPickUpOnCookComplete = useTableStore((state) => state.orderWorkflowSettings?.autoPickUpOnCookComplete ?? false);

  const handleConfirm = async () => {
    if (duringConfirm) return;

    setDuringConfirm(true);
    try {
      await useTableStore.getState().adminCompleteOrder({
        menuOrderId,
      });
      setOpenState(false);
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleClose = () => {
    if (duringConfirm) return;
    setOpenState(false);
  }
  
  return (
    <Dialog open={openState} onOpenChange={setOpenState}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tableName} - {menuName} 조리 완료 처리</DialogTitle>
          <DialogDescription>
            {autoPickUpOnCookComplete ? "조리완료와 수령완료를 함께 처리합니다." : "조리 완료 처리 하시겠습니까?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={duringConfirm}>취소</Button>
          <Button className="dangerBG dangerB" onClick={handleConfirm} disabled={duringConfirm}>
            {duringConfirm ? "처리 중..." : "조리 완료"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog> 
  );
}
