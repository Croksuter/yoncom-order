import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import useTableStore from "~/stores/table.store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";

export default function CreateTableModal({
  openState, setOpenState,
  modalClassName,
}: {
  openState: boolean;
  setOpenState: any;
  modalClassName?: string;
}) {
  const [tableId, setTableId] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [tableSeats, setTableSeats] = useState<number>(0);
  const [isTakeout, setIsTakeout] = useState(false);
  const [takeoutFirstOrderRuleEnabled, setTakeoutFirstOrderRuleEnabled] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);

  const { tables, updateTable } = useTableStore();

  const handleConfirm = async () => {
    if (duringConfirm) return;

    if (
      tableId.length === 0
      || tableName.length === 0
      || tableSeats <= 0
    ) {
      setInvalid(true);
      return;
    }

    setDuringConfirm(true);
    try {
      await updateTable({
        tableId,
        tableOptions: {
          name: tableName,
          seats: tableSeats,
          isTakeout,
          takeoutFirstOrderRuleEnabled,
        },
      });
      setTableId("");
      setTableName("");
      setTableSeats(0);
      setIsTakeout(false);
      setTakeoutFirstOrderRuleEnabled(true);
      setInvalid(false);
      setOpenState(false);
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleClose = () => {
    if (duringConfirm) return;
    setTableId("");
    setTableName("");
    setTableSeats(0);
    setIsTakeout(false);
    setTakeoutFirstOrderRuleEnabled(true);
    setInvalid(false);
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className={modalClassName}>
        <DialogHeader>
          <DialogTitle>테이블 변경</DialogTitle>
          <DialogDescription>테이블 설정을 변경하세요.</DialogDescription>
        </DialogHeader>
        <Select value={tableId} onValueChange={(value: string) => {
          const table = tables.find((item) => item.id === value);
          setTableId(value);
          setTableName(table?.name || "");
          setTableSeats(table?.seats || 0);
          setIsTakeout(table?.isTakeout ?? false);
          setTakeoutFirstOrderRuleEnabled(table?.takeoutFirstOrderRuleEnabled ?? true);
        }}>
          <SelectTrigger>
            <SelectValue placeholder="변경할 테이블을 선택하세요"></SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) =>
              <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
            )}
          </SelectContent>
        </Select>
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
        <div className="space-y-2 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
          <label className="flex items-center gap-2 text-sm font-bold">
            <Checkbox
              checked={isTakeout}
              onCheckedChange={(checked) => setIsTakeout(checked === true)}
              disabled={duringConfirm}
            />
            테이크아웃 테이블
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <Checkbox
              checked={takeoutFirstOrderRuleEnabled}
              onCheckedChange={(checked) => setTakeoutFirstOrderRuleEnabled(checked === true)}
              disabled={duringConfirm || !isTakeout}
            />
            첫주문 제한 적용
          </label>
        </div>
        <DialogDescription className={`-mt-2 text-right ${invalid ? "dangerTXT" : "hidden"}`}>⚠︎ 올바른 이름과 좌석 수를 입력하세요.</DialogDescription>
        <DialogFooter className="">
          <Button variant="outline" onClick={handleClose} disabled={duringConfirm}>취소</Button>
          <Button onClick={handleConfirm} disabled={duringConfirm}>
            {duringConfirm ? "처리 중..." : "확인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}
