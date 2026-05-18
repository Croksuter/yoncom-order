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
  const handleConfirm = async () => {
    await useTableStore.getState().adminCompleteOrder({
      menuOrderId,
    });
    setOpenState(false);
  }

  const handleClose = () => {
    setOpenState(false);
  }
  
  return (
    <Dialog open={openState} onOpenChange={setOpenState}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tableName} - {menuName} 조리 완료 처리</DialogTitle>
          <DialogDescription>조리 완료 처리 하시겠습니까?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button className="dangerBG dangerB" onClick={handleConfirm}>조리 완료</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog> 
  );
}