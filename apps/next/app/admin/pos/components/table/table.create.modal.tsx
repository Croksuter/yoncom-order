import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import useTableStore from "~/stores/table.store";

export default function CreateTableModal({
  openState, setOpenState,
  modalClassName,
}: {
  openState: boolean;
  setOpenState: any;
  modalClassName?: string;
}) {
  const [tableName, setTableName] = useState<string>("");
  const [tableSeats, setTableSeats] = useState<number>(0);
  const [invalid, setInvalid] = useState(false);

  const { createTable } = useTableStore();

  const handleConfirm = async () => {
    if (tableName.length === 0) {
      setInvalid(true);
      return;
    }

    if (tableSeats <= 0) {
      setInvalid(true);
      return;
    }

    await createTable({ tableOptions: { name: tableName, seats: tableSeats } });
    handleClose();
  }

  const handleClose = () => {
    setTableName("");
    setTableSeats(0);
    setInvalid(false);
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className={modalClassName}>
        <DialogHeader>
          <DialogTitle>테이블 생성</DialogTitle>
          <DialogDescription>새롭게 만들 테이블 설정을 입력하세요.</DialogDescription>
        </DialogHeader>
        <div className="fr items-center">
          <span className="mr-2 min-w-fit font-bold text-sm">테이블 이름</span>
          <Input
            type="text"
            placeholder="테이블 이름을 입력하세요"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
          />
        </div>
        <div className="fr items-center">
          <span className="mr-2 min-w-fit font-bold text-sm">테이블 좌석 수</span>
          <Input
            type="number"
            placeholder="테이블 좌석 수를 입력하세요"
            value={tableSeats}
            onChange={(e) => setTableSeats(Number(e.target.value))}
          />
        </div>
        <DialogDescription className={`-mt-2 text-right ${invalid ? "dangerTXT" : "hidden"}`}>⚠︎ 올바른 이름과 좌석 수를 입력하세요.</DialogDescription>
        <DialogFooter className="">
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button onClick={handleConfirm}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}