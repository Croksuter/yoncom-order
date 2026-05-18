import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useTableStore from "~/stores/table.store";

export default function RemoveTableModal({
  openState, setOpenState,
  modalClassName,
}: {
  openState: boolean;
  setOpenState: any;
  modalClassName?: string;
}) {
  const [tableId, setTableId] = useState<string>("");
  const [invalid, setInvalid] = useState(false);

  const { tables, removeTable } = useTableStore();

  const handleConfirm = async () => {
    if (tableId.length === 0) {
      setInvalid(true);
      return;
    }

    await removeTable({ tableId });
    handleClose();
  }

  const handleClose = () => {
    setTableId("");
    setInvalid(false);
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className={modalClassName}>
        <DialogHeader>
          <DialogTitle>테이블 제거</DialogTitle>
          <DialogDescription>제거할 테이블을 선택하세요. 활성화 중인 테이블은 제거할 수 없습니다.</DialogDescription>
        </DialogHeader>
        <Select value={tableId} onValueChange={setTableId}>
          <SelectTrigger>
            <SelectValue placeholder="제거할 테이블을 선택하세요"></SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tables
              .filter((table) => table.deletedAt === null)
              .filter((table) => !table.tableContexts.some((tableContext) => tableContext.deletedAt === null))
              .map((table) => 
                <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <DialogDescription className={`-mt-2 text-right ${invalid ? "dangerTXT" : "hidden"}`}>⚠︎ 올바른 테이블을 선택하세요.</DialogDescription>
        <DialogFooter className="">
          <Button onClick={handleClose} variant="outline">취소</Button>
          <Button onClick={handleConfirm}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}