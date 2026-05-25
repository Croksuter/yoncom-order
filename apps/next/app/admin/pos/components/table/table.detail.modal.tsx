import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import useTableStore from "~/stores/table.store";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import { Input } from "~/components/ui/input";
import { useCallback, useEffect, useState } from "react";

export default function TableDetailModal({
  table,
  openState, setOpenState,
  modalClassName,
}: {
  table: AdminTableResponse.Get["result"][0];
  openState: boolean;
  setOpenState: (openState: boolean) => void;
  modalClassName?: string;
}) {
  const [invalid, setInvalid] = useState(false);
  const [tableName, setTableName] = useState(table.name);
  const [tableSeats, setTableSeats] = useState(table.seats);
  const activeTableContext = table.tableContexts.find((tableContext) => tableContext.deletedAt === null);
  const inUse = activeTableContext !== undefined;
  const prompt = inUse ? "미사용" : "사용 중";
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
      <DialogContent className={modalClassName}>
        <DialogHeader>
          <DialogTitle>테이블 상세</DialogTitle>
          <DialogDescription className="text-neutral-800 !-mb-2"><b>이름:</b> {table.name}</DialogDescription>
          <DialogDescription className="text-neutral-800 !-mb-2"><b>Id:</b> {table.id}</DialogDescription>
          <DialogDescription className="text-neutral-800"><b>상태:</b> {inUse ? "사용 중" : "미사용"}</DialogDescription>
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
        <DialogFooter>
          <Button className="bg-slate-600 text-white" onClick={handleTablePage} disabled={isPending}>테이블 페이지</Button>
          <Button className="dangerBG dangerB text-white" onClick={handleConfirm} disabled={isPending}>
            {pendingAction === "toggle" ? "처리 중..." : inUse ? "비활성화" : "활성화"}
          </Button>
          <Button className="dangerBG dangerB text-white" onClick={handleUpdate} disabled={isPending}>
            {pendingAction === "update" ? "처리 중..." : "수정"}
          </Button>
          <Button onClick={handleCancel} disabled={isPending}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}
