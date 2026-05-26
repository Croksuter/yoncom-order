import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useMenuStore from "~/stores/menu.store";
import { Plus, Trash2 } from "lucide-react";

type BundleRow = {
  componentMenuId: string;
  quantity: number;
};

export default function BundleManageModal({
  openState,
  setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const { menus, updateMenuBundle } = useMenuStore();
  const activeMenus = useMemo(
    () => menus.filter((menu) => menu.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name)),
    [menus],
  );
  const [bundleMenuId, setBundleMenuId] = useState("");
  const [items, setItems] = useState<BundleRow[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);
  const selectedBundle = activeMenus.find((menu) => menu.id === bundleMenuId) ?? null;

  useEffect(() => {
    if (!openState) return;
    setInvalid(false);
  }, [openState]);

  useEffect(() => {
    if (!selectedBundle) {
      setItems([]);
      return;
    }
    setItems((selectedBundle.bundleItems ?? []).map((item) => ({
      componentMenuId: item.componentMenuId,
      quantity: item.quantity,
    })));
  }, [selectedBundle]);

  const handleClose = () => {
    if (duringConfirm) return;
    setBundleMenuId("");
    setItems([]);
    setInvalid(false);
    setOpenState(false);
  };

  const updateItem = (index: number, patch: Partial<BundleRow>) => {
    setItems((state) => state.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const componentOptions = (row: BundleRow) => activeMenus.filter((menu) => (
    menu.id !== bundleMenuId
    && ((menu.bundleItems?.length ?? 0) === 0 || menu.id === row.componentMenuId)
    && (!items.some((item) => item.componentMenuId === menu.id) || menu.id === row.componentMenuId)
  ));

  const handleConfirm = async () => {
    if (duringConfirm) return;
    const normalizedItems = items.filter((item) => item.componentMenuId && item.quantity > 0);
    if (!bundleMenuId || normalizedItems.length !== items.length) {
      setInvalid(true);
      return;
    }

    setDuringConfirm(true);
    try {
      const response = await updateMenuBundle({ bundleMenuId, items: normalizedItems });
      if (response) {
        handleClose();
      }
    } finally {
      setDuringConfirm(false);
    }
  };

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100">세트메뉴 구성</DialogTitle>
          <DialogDescription className="text-xs text-slate-455 dark:text-slate-300 font-semibold">
            선택한 세트 메뉴는 주문에 한 줄로 표시되고, 재고는 구성 메뉴에서 차감됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div className="fc gap-1.5">
            <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">세트로 사용할 메뉴</label>
            <Select value={bundleMenuId} onValueChange={setBundleMenuId} disabled={duringConfirm}>
              <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm">
                <SelectValue placeholder="메뉴 선택" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                {activeMenus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id} className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                    {menu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bundleMenuId && (
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-950/40">
                <span className="text-xs font-black text-slate-500 dark:text-slate-300">구성 메뉴</span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setItems((state) => [...state, { componentMenuId: "", quantity: 1 }])}
                  disabled={duringConfirm}
                  className="h-7 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  추가
                </Button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {items.length === 0 ? (
                  <div className="p-4 text-center text-xs font-semibold text-slate-400">구성 메뉴를 추가하지 않으면 일반 메뉴로 동작합니다</div>
                ) : items.map((item, index) => (
                  <div key={`${item.componentMenuId}-${index}`} className="grid grid-cols-[1fr_88px_32px] gap-2 px-3 py-2 items-center">
                    <Select
                      value={item.componentMenuId}
                      onValueChange={(componentMenuId) => updateItem(index, { componentMenuId })}
                      disabled={duringConfirm}
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-9 font-medium text-xs">
                        <SelectValue placeholder="구성 메뉴 선택" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                        {componentOptions(item).map((menu) => (
                          <SelectItem key={menu.id} value={menu.id} className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                            {menu.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={item.quantity}
                      onChange={(event) => updateItem(index, { quantity: Math.max(1, Math.min(99, Number(event.target.value) || 1)) })}
                      disabled={duringConfirm}
                      className="h-9 rounded-xl text-xs font-bold"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setItems((state) => state.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={duringConfirm}
                      className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invalid && (
            <p className="text-xs font-bold text-rose-500">세트 메뉴와 모든 구성 메뉴를 선택해야 합니다.</p>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 dark:border-slate-850 pt-4 flex gap-2">
          <Button onClick={handleClose} variant="outline" disabled={duringConfirm} className="rounded-xl font-bold">
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={duringConfirm || !bundleMenuId} className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold">
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
