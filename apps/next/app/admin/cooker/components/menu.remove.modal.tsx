import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useMenuStore from "~/stores/menu.store";
import { Trash2 } from "lucide-react";

export default function MenuRemoveModal({
  openState, setOpenState,
  monitoringMenus,
  setMonitoringMenus,
}: {
  openState: boolean;
  setOpenState: any;
  monitoringMenus: string[];
  setMonitoringMenus: (menus: string[]) => void;
}) {
  const { menus } = useMenuStore();

  const [monitoringMenu, setMonitoringMenu] = useState<string>("");
  const [invalid, setInvalid] = useState(false);

  const handleConfirm = () => {
    if (monitoringMenu.length === 0) {
      setInvalid(true);
      return;
    }

    setMonitoringMenus(monitoringMenus.filter((menuId) => menuId !== monitoringMenu));
    handleClose();
  }

  const handleClose = () => {
    setMonitoringMenu("");
    setInvalid(false);
    setOpenState(false);
  }

  // Filter active monitoring menus and sort alphabetically
  const activeMonitoringMenus = menus
    .filter((menu) => menu?.deletedAt === null && monitoringMenus.includes(menu.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader className="w-full">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-500 shrink-0" />
            <DialogTitle className="text-lg font-black text-slate-800 dark:text-slate-100">모니터링 메뉴 제외</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-450 dark:text-slate-500 font-semibold mt-1">
            주방 모니터 화면에서 모니터링을 중단할 메뉴를 선택합니다. (실제 메뉴는 삭제되지 않습니다)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4 fc">
          <div className="fc gap-1.5 w-full">
            <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-500 px-0.5">제외할 메뉴 선택</label>
            <Select value={monitoringMenu} onValueChange={setMonitoringMenu}>
              <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:ring-rose-500">
                <SelectValue placeholder="모니터링에서 제외할 메뉴를 선택하세요" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                {activeMonitoringMenus.length === 0 ? (
                  <div className="p-3 text-center text-xs font-semibold text-slate-400">모니터링 중인 유효 메뉴가 없습니다</div>
                ) : (
                  activeMonitoringMenus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id} className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                      {menu.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {invalid && (
          <p className="text-rose-500 dark:text-rose-455 text-xs font-semibold px-0.5 flex items-center gap-1.5 animate-pulse">
            ⚠️ 제외할 메뉴 대상을 반드시 선택해야 합니다.
          </p>
        )}

        <DialogFooter className="border-t border-slate-100 dark:border-slate-850 pt-4 flex gap-2">
          <Button
            onClick={handleClose}
            variant="outline"
            className="border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm px-5 h-10 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={monitoringMenu.length === 0}
            className="font-bold text-sm px-6 h-10 transition-all shadow-sm border-none text-white bg-rose-500 hover:bg-rose-600 shadow-rose-500/10"
          >
            확인 및 제외
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
