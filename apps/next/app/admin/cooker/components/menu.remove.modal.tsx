import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useMenuStore from "~/stores/menu.store";

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

  const handleConfirm = async () => {
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

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>메뉴 제거</DialogTitle>
          <DialogDescription>모니터링에서 제외할 메뉴를 선택하세요.</DialogDescription>
        </DialogHeader>
        <Select value={monitoringMenu} onValueChange={setMonitoringMenu}>
          <SelectTrigger>
            <SelectValue placeholder="모니터링에서 제외할 메뉴를 선택하세요"></SelectValue>
          </SelectTrigger>
          <SelectContent>
            {monitoringMenus.map((menuId) => 
              <SelectItem key={menuId} value={menuId}>{menus.find((menu) => menu.id === menuId)?.name}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <DialogDescription className={`-mt-2 text-right ${invalid ? "dangerTXT" : "hidden"}`}>⚠︎ 올바른 메뉴를 선택하세요.</DialogDescription>
        <DialogFooter className="">
          <Button onClick={handleClose} variant="outline">취소</Button>
          <Button onClick={handleConfirm}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}