import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import useTableStore from "~/stores/table.store";

export default function CreateTableModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: any;
}) {
  const [tableName, setTableName] = useState<string>("");
  const [tableSeats, setTableSeats] = useState<number>(0);
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);

  const { createTable } = useTableStore();

  const handleConfirm = async () => {
    if (duringConfirm) return;

    if (tableName.length === 0 || tableSeats <= 0) {
      setInvalid(true);
      return;
    }

    setDuringConfirm(true);
    try {
      await createTable({ tableOptions: { name: tableName, seats: tableSeats } });
      setTableName("");
      setTableSeats(0);
      setInvalid(false);
      setOpenState(false);
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleClose = () => {
    if (duringConfirm) return;
    setTableName("");
    setTableSeats(0);
    setInvalid(false);
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader className="w-full">
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100">테이블 생성</DialogTitle>
          <DialogDescription className="text-xs text-slate-400 dark:text-slate-300 font-semibold">새롭게 생성할 테이블의 설정 항목을 입력하세요.</DialogDescription>
        </DialogHeader>

        {/* Input Fields */}
        <div className="space-y-4 my-4">
          <div className="fc gap-1.5">
            <label className="text-xs uppercase font-bold text-slate-400 dark:text-slate-300 px-0.5">테이블 명칭</label>
            <Input
              type="text"
              placeholder="예: 테이블 1, 부스 A"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
              disabled={duringConfirm}
            />
          </div>

          <div className="fc gap-1.5">
            <label className="text-xs uppercase font-bold text-slate-400 dark:text-slate-300 px-0.5">테이블 좌석 수 (명)</label>
            <Input
              type="number"
              placeholder="좌석 수를 입력하세요"
              value={tableSeats === 0 ? "" : tableSeats}
              onChange={(e) => setTableSeats(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
              disabled={duringConfirm}
            />
          </div>

          {invalid && (
            <p className="text-rose-500 dark:text-rose-450 text-xs font-semibold px-0.5 flex items-center gap-1.5 animate-pulse">
              ⚠️ 올바른 명칭과 1명 이상의 좌석 수를 입력하세요.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <DialogFooter className="border-t border-slate-100 dark:border-slate-850 pt-4 flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={duringConfirm}
            className="border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm px-5 h-10 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
          >
            취소
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={duringConfirm}
            className="bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm px-6 h-10 transition-all shadow-sm border-none shadow-brand-500/10"
          >
            {duringConfirm ? "생성 중..." : "확인 및 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
