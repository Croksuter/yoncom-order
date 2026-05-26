import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useTableStore from "~/stores/table.store";

export default function RemoveTableModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: any;
}) {
  const [tableId, setTableId] = useState<string>("");
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);

  const { tables, removeTable } = useTableStore();

  const handleConfirm = async () => {
    if (duringConfirm) return;

    if (tableId.length === 0) {
      setInvalid(true);
      return;
    }

    setDuringConfirm(true);
    try {
      await removeTable({ tableId });
      setTableId("");
      setInvalid(false);
      setOpenState(false);
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleClose = () => {
    if (duringConfirm) return;
    setTableId("");
    setInvalid(false);
    setOpenState(false);
  }

  const deletableTables = tables
    .filter((table) => table.deletedAt === null)
    .filter((table) => !table.tableContexts.some((tableContext) => tableContext.deletedAt === null));

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader className="w-full">
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100">테이블 제거</DialogTitle>
          <DialogDescription className="text-xs text-slate-400 dark:text-slate-300 font-semibold leading-relaxed">
            제거할 테이블을 선택하세요. 현재 활성화 상태인 (사용 중인) 테이블은 안전을 위해 목록에 노출되지 않으며 제거할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        {/* Select Input Field */}
        <div className="space-y-4 my-4 fc">
          <label className="text-xs uppercase font-bold text-slate-400 dark:text-slate-300 px-0.5">대상 테이블 선택</label>
          <Select value={tableId} onValueChange={setTableId}>
            <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:ring-rose-500">
              <SelectValue placeholder="제거할 테이블을 선택하세요" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl">
              {deletableTables.length === 0 ? (
                <div className="p-3 text-center text-xs font-semibold text-slate-400">제거 가능한 테이블이 없습니다</div>
              ) : (
                deletableTables.map((table) => (
                  <SelectItem key={table.id} value={table.id} className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                    {table.name} ({table.seats}인석)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {invalid && (
            <p className="text-rose-500 dark:text-rose-450 text-xs font-semibold px-0.5 flex items-center gap-1.5 animate-pulse">
              ⚠️ 제거할 대상 테이블을 반드시 선택해야 합니다.
            </p>
          )}
        </div>

        {/* Actions buttons */}
        <DialogFooter className="border-t border-slate-100 dark:border-slate-850 pt-4 flex gap-2">
          <Button 
            onClick={handleClose} 
            variant="outline" 
            disabled={duringConfirm}
            className="border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm px-5 h-10 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
          >
            취소
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={duringConfirm || deletableTables.length === 0}
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-sm px-6 h-10 transition-all shadow-sm border-none shadow-rose-500/10"
          >
            {duringConfirm ? "제거 중..." : "확인 및 제거"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
