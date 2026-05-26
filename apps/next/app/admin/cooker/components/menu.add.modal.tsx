import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useMenuStore from "~/stores/menu.store";
import { Plus } from "lucide-react";

export default function MenuAddModal({
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

    setMonitoringMenus([...monitoringMenus, monitoringMenu]);
    handleClose();
  }

  const handleClose = () => {
    setMonitoringMenu("");
    setInvalid(false);
    setOpenState(false);
  }

  const availableMenus = menus
    .filter((menu) => menu?.deletedAt === null)
    .filter((menu) => !monitoringMenus.includes(menu.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader className="w-full">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-brand-500 shrink-0" />
            <DialogTitle className="text-lg font-black text-slate-800 dark:text-slate-100">모니터링 메뉴 추가</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-450 dark:text-slate-500 font-semibold mt-1">
            주방 모니터 화면에 추가로 실시간 조리 대기열을 띄울 메뉴를 선택합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4 fc">
          <div className="fc gap-1.5 w-full">
            <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-500 px-0.5">추가할 메뉴 선택</label>
            <Select value={monitoringMenu} onValueChange={setMonitoringMenu}>
              <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:ring-brand-500">
                <SelectValue placeholder="모니터링할 메뉴를 선택하세요" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                {availableMenus.length === 0 ? (
                  <div className="p-3 text-center text-xs font-semibold text-slate-400">추가할 수 있는 신규 메뉴가 없습니다</div>
                ) : (
                  availableMenus.map((menu) => (
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
            ⚠️ 추가할 메뉴 대상을 반드시 선택해야 합니다.
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
            className="font-bold text-sm px-6 h-10 transition-all shadow-sm border-none text-white bg-brand-500 hover:bg-brand-600 shadow-brand-500/10"
          >
            확인 및 추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
