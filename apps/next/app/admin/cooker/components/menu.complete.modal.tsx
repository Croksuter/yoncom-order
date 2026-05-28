import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import useTableStore from "~/stores/table.store";
import { Minus, Plus } from "lucide-react";

export default function MenuCompleteModal({
  openState, setOpenState,
  menuName,
  tableName,
  menuOrderId,
  pendingQuantity,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  menuName: string;
  tableName: string;
  menuOrderId: string;
  pendingQuantity: number;
}) {
  const [duringConfirm, setDuringConfirm] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(Math.max(1, pendingQuantity));
  const autoPickUpOnCookComplete = useTableStore((state) => state.orderWorkflowSettings?.autoPickUpOnCookComplete ?? false);

  useEffect(() => {
    if (!openState) return;
    setSelectedQuantity(Math.max(1, pendingQuantity));
  }, [openState, pendingQuantity]);

  const updateSelectedQuantity = (nextQuantity: number) => {
    setSelectedQuantity(Math.min(pendingQuantity, Math.max(1, nextQuantity)));
  };

  const handleConfirm = async () => {
    if (duringConfirm || pendingQuantity <= 0) return;

    setDuringConfirm(true);
    try {
      await useTableStore.getState().adminCompleteOrder({
        menuOrderId,
        quantity: selectedQuantity,
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

        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-300">조리 대기 수량</p>
            <p className="mt-1 text-4xl font-black text-slate-800 dark:text-slate-100">{pendingQuantity}</p>
          </div>

          <div className="grid grid-cols-[72px_1fr_72px] items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-16 rounded-2xl border-slate-200 dark:border-slate-800"
              onClick={() => updateSelectedQuantity(selectedQuantity - 1)}
              disabled={duringConfirm || selectedQuantity <= 1}
            >
              <Minus className="h-6 w-6" />
            </Button>
            <div className="flex h-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-3xl font-black text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
              {selectedQuantity}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-16 rounded-2xl border-slate-200 dark:border-slate-800"
              onClick={() => updateSelectedQuantity(selectedQuantity + 1)}
              disabled={duringConfirm || selectedQuantity >= pendingQuantity}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "1", value: 1 },
              { label: "절반", value: Math.max(1, Math.ceil(pendingQuantity / 2)) },
              { label: "전체", value: pendingQuantity },
            ].map((item) => (
              <Button
                key={item.label}
                type="button"
                variant={selectedQuantity === item.value ? "default" : "outline"}
                className="h-12 rounded-xl font-extrabold"
                onClick={() => updateSelectedQuantity(item.value)}
                disabled={duringConfirm || pendingQuantity <= 0}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} disabled={duringConfirm} className="h-12 rounded-xl px-6 font-bold">취소</Button>
          <Button className="dangerBG dangerB h-12 rounded-xl px-6 font-extrabold" onClick={handleConfirm} disabled={duringConfirm || pendingQuantity <= 0}>
            {duringConfirm ? "처리 중..." : `${selectedQuantity}개 조리 완료`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog> 
  );
}
