import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import useTableStore from "~/stores/table.store";
import * as AdminTableResponse from "shared/types/responses/admin/table";

export default function TableSetModal({
  table,
  openState, setOpenState,
}: {
  table: AdminTableResponse.Get["result"][0];
  openState: boolean;
  setOpenState: (openState: boolean) => void;
}) {
  const activeTableContext = table.tableContexts.find((tableContext) => tableContext.deletedAt === null);
  const inUse = activeTableContext !== undefined;
  const prompt = inUse ? "미사용 (비활성화)" : "사용 중 (활성화)";
  const { occupyTable, vacateTable } = useTableStore();
  const confirmFunction = inUse ? vacateTable : occupyTable;
  const [duringConfirm, setDuringConfirm] = useState(false);

  const handleConfirm = async () => {
    if (duringConfirm) return;

    setDuringConfirm(true);
    try {
      await confirmFunction({ tableId: table.id });
      setOpenState(false);
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleCancel = () => {
    if (duringConfirm) return;
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader className="w-full">
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>테이블 상태 변경</span>
          </DialogTitle>
          <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-850 font-medium text-sm text-slate-600 dark:text-slate-350 leading-relaxed">
            현재 식별코드 <span className="font-mono text-xs text-brand-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-800 font-bold">{table.id.slice(-8).toUpperCase()}</span> 인
            <br />
            <span className="font-bold text-slate-800 dark:text-slate-100 text-base">"{table.name}"</span> 테이블을 
            <span className={`mx-1 font-bold ${inUse ? "text-rose-500" : "text-emerald-500"}`}>{prompt}</span> 상태로 변경하시겠습니까?
          </div>
        </DialogHeader>

        {inUse && (
          <div className="my-4 p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-100/30 dark:border-rose-900/30 text-xs font-medium leading-relaxed flex items-start gap-2">
            <span className="text-base select-none leading-none">⚠️</span>
            <span>
              <strong className="font-bold">경고:</strong> 테이블이 미사용 상태로 변경되면, 해당 테이블의 모든 실시간 주문 내역이 즉시 초기화되며 진행 중인 주문은 전부 취소됩니다. 이 작업은 되돌릴 수 없습니다.
            </span>
          </div>
        )}

        <DialogFooter className="mt-4 border-t border-slate-100 dark:border-slate-850 pt-4 flex gap-2">
          <Button 
            onClick={handleCancel} 
            variant="outline" 
            disabled={duringConfirm}
            className="border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm px-5 h-10 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
          >
            취소
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={duringConfirm}
            className={`rounded-xl font-bold text-sm px-6 h-10 transition-all shadow-sm border-none text-white ${
              inUse 
                ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/10" 
                : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10"
            }`}
          >
            {duringConfirm ? "처리 중..." : "확인 및 변경"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
