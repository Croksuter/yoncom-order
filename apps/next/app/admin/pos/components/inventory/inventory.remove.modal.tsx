import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useMenuStore from "~/stores/menu.store";

export default function InventoryRemoveModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: any;
}) {
  const [menuId, setMenuId] = useState<string>("");
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);
  const { menus, removeMenu } = useMenuStore();

  const handleConfirm = async () => {
    if (duringConfirm) return;

    if (menuId.length === 0) {
      setInvalid(true);
      return;
    }

    setDuringConfirm(true);
    try {
      await removeMenu({ menuId });
      setMenuId("");
      setInvalid(false);
      setOpenState(false);
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleClose = () => {
    if (duringConfirm) return;
    setMenuId("");
    setInvalid(false);
    setOpenState(false);
  }

  const deletableMenus = menus
    .filter((menu) => menu?.deletedAt === null)
    .filter((menu) => !menu.available); // ONLY inactive (disabled) menus can be deleted for safety

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader className="w-full">
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100">메뉴 제거</DialogTitle>
          <DialogDescription className="text-xs text-slate-400 dark:text-slate-500 font-semibold leading-relaxed">
            제거할 메뉴를 선택하세요. 실수로 데이터를 삭제하는 사고를 방지하기 위해, 현재 활성화(판매 중) 상태인 메뉴는 목록에 노출되지 않으며 안전하게 비활성화 처리 후 제거할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {/* Dropdown Field */}
        <div className="space-y-4 my-4 fc">
          <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-500 px-0.5">제거 대상 메뉴 선택</label>
          <Select value={menuId} onValueChange={setMenuId}>
            <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:ring-rose-500">
              <SelectValue placeholder="제거할 메뉴를 선택하세요" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl">
              {deletableMenus.length === 0 ? (
                <div className="p-3 text-center text-xs font-semibold text-slate-400">제거 가능한 비활성 메뉴가 없습니다</div>
              ) : (
                deletableMenus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id} className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                    {menu.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {invalid && (
            <p className="text-rose-500 dark:text-rose-455 text-xs font-semibold px-0.5 flex items-center gap-1.5 animate-pulse">
              ⚠️ 제거할 대상 메뉴를 반드시 선택해야 합니다.
            </p>
          )}
        </div>

        {/* Footer Actions */}
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
            disabled={duringConfirm || deletableMenus.length === 0}
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-sm px-6 h-10 transition-all shadow-sm border-none shadow-rose-500/10"
          >
            {duringConfirm ? "제거 중..." : "확인 및 제거"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
