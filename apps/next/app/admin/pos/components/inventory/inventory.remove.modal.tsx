import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useMenuStore from "~/stores/menu.store";

export default function InventoryRemoveModal({
  openState, setOpenState,
  modalClassName,
}: {
  openState: boolean;
  setOpenState: any;
  modalClassName?: string;
}) {
  const [menuId, setMenuId] = useState<string>("");
  const [invalid, setInvalid] = useState(false);
  const { menus, removeMenu } = useMenuStore();


  const handleConfirm = async () => {
    if (menuId.length === 0) {
      setInvalid(true);
      return;
    }

    await removeMenu({ menuId });
    handleClose();
  }

  const handleClose = () => {
    setMenuId("");
    setInvalid(false);
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className={modalClassName}>
        <DialogHeader>
          <DialogTitle>메뉴 제거</DialogTitle>
          <DialogDescription>제거할 메뉴를 선택하세요. 활성화 중인 메뉴는 제거할 수 없습니다.</DialogDescription>
        </DialogHeader>
        <Select value={menuId} onValueChange={setMenuId}>
          <SelectTrigger>
            <SelectValue placeholder="제거할 메뉴를 선택하세요"></SelectValue>
          </SelectTrigger>
          <SelectContent>
            {menus
              .filter((menu) => menu?.deletedAt === null)
              .map((menu) => 
                <SelectItem key={menu.id} value={menu.id}>{menu.name}</SelectItem>
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