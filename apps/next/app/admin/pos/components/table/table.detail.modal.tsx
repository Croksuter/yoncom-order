import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import useTableStore from "~/stores/table.store";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import { Input } from "~/components/ui/input";
import { useCallback, useEffect, useState } from "react";

export default function TableDetailModal({
  table,
  openState, setOpenState,
}: {
  table: AdminTableResponse.Get["result"][0];
  openState: boolean;
  setOpenState: (openState: boolean) => void;
}) {
  const [invalid, setInvalid] = useState(false);
  const [tableName, setTableName] = useState(table.name);
  const [tableSeats, setTableSeats] = useState(table.seats);
  const activeTableContext = table.tableContexts.find((tableContext) => tableContext.deletedAt === null);
  const inUse = activeTableContext !== undefined;
  const { updateTable, occupyTable, vacateTable } = useTableStore();
  const confirmFunction = inUse ? vacateTable : occupyTable;
  const [pendingAction, setPendingAction] = useState<"toggle" | "update" | null>(null);
  const isPending = pendingAction !== null;

  const resetForm = useCallback(() => {
    setTableName(table.name);
    setTableSeats(table.seats);
    setInvalid(false);
  }, [table]);

  const handleConfirm = async () => {
    if (isPending) return;

    setPendingAction("toggle");
    try {
      await confirmFunction({ tableId: table.id });
      setOpenState(false);
    } finally {
      setPendingAction(null);
    }
  }

  const handleTablePage = async () => {
    window.open(`/client/table/${table.id}`, "_blank");
  }

  const handleUpdate = async () => {
    if (isPending) return;

    if (
      tableName.length === 0
      || tableSeats <= 0
    ) {
      setInvalid(true);
      return;
    }

    setPendingAction("update");
    try {
      await updateTable({ tableId: table.id, tableOptions: { name: tableName, seats: tableSeats } });
      setOpenState(false);
    } finally {
      setPendingAction(null);
    }
  }

  const handleCancel = () => {
    if (isPending) return;
    resetForm();
    setOpenState(false);
  }

  useEffect(() => {
    if (openState) {
      resetForm();
    }
  }, [openState, resetForm]);

  return (
    <Dialog open={openState} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader className="w-full">
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center justify-between">
            <span>테이블 설정 상세</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              inUse 
                ? "bg-brand-50 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400" 
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {inUse ? "사용 중 (활성화)" : "미사용 (비활성화)"}
            </span>
          </DialogTitle>
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-850 text-sm font-medium text-slate-500 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-400">테이블 ID</span>
              <code className="text-xs text-slate-600 dark:text-slate-400 font-mono font-bold bg-white dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-850">{table.id.slice(-8).toUpperCase()}</code>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-400">테이블 명칭</span>
              <span className="text-slate-700 dark:text-slate-200 font-bold">{table.name}</span>
            </div>
          </div>
        </DialogHeader>
        
        {/* Form Fields */}
        <div className="space-y-4 my-4">
          <div className="fc gap-1.5">
            <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-500 px-0.5">테이블 이름</label>
            <Input
              type="text"
              placeholder="테이블 이름을 입력하세요"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
              disabled={isPending}
            />
          </div>
          
          <div className="fc gap-1.5">
            <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-500 px-0.5">테이블 좌석 수 (명)</label>
            <Input
              type="number"
              placeholder="테이블 좌석 수를 입력하세요"
              value={tableSeats}
              onChange={(e) => setTableSeats(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
              disabled={isPending}
            />
          </div>
          
          {invalid && (
            <p className="text-rose-500 dark:text-rose-400 text-xs font-semibold px-0.5 flex items-center gap-1.5 animate-pulse">
              ⚠️ 올바른 테이블 이름과 1명 이상의 좌석 수를 입력하세요.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t border-slate-100 dark:border-slate-850 pt-4 flex flex-col gap-2">
          <div className="flex gap-2 w-full justify-between items-center">
            <div className="flex gap-2">
              <Button 
                onClick={handleTablePage} 
                disabled={isPending}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-sm px-4 h-10 transition-all border-none"
              >
                테이블 페이지
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={isPending}
                className={`rounded-xl font-bold text-sm px-4 h-10 transition-all shadow-sm border-none text-white ${
                  inUse 
                    ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/10" 
                    : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10"
                }`}
              >
                {pendingAction === "toggle" ? "처리 중..." : inUse ? "테이블 비활성화" : "테이블 활성화"}
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleUpdate} 
                disabled={isPending}
                className="bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm px-5 h-10 transition-all shadow-sm border-none shadow-brand-500/10"
              >
                {pendingAction === "update" ? "처리 중..." : "설정 수정"}
              </Button>
              <Button 
                onClick={handleCancel} 
                disabled={isPending}
                variant="outline"
                className="border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm px-4 h-10 text-slate-500"
              >
                닫기
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
