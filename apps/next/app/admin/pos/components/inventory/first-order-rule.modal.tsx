import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import useMenuStore from "~/stores/menu.store";

export default function FirstOrderRuleModal({
  openState,
  setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const { menuCategories, menus, firstOrderRule, loadFirstOrderRule, updateFirstOrderRule } = useMenuStore();
  const [enabled, setEnabled] = useState(false);
  const [requiredCount, setRequiredCount] = useState(1);
  const [menuCounts, setMenuCounts] = useState<Record<string, number>>({});
  const [duringConfirm, setDuringConfirm] = useState(false);

  const activeMenus = useMemo(
    () => menus
      .filter((menu) => menu.deletedAt === null)
      .sort((a, b) => {
        const leftCategory = menuCategories.find((category) => category.id === a.menuCategoryId)?.name ?? "";
        const rightCategory = menuCategories.find((category) => category.id === b.menuCategoryId)?.name ?? "";
        return leftCategory.localeCompare(rightCategory) || a.name.localeCompare(b.name);
      }),
    [menuCategories, menus],
  );

  useEffect(() => {
    if (!openState) return;
    void loadFirstOrderRule({});
  }, [loadFirstOrderRule, openState]);

  useEffect(() => {
    if (!openState || !firstOrderRule) return;
    setEnabled(firstOrderRule.enabled);
    setRequiredCount(firstOrderRule.requiredCount || 1);
    setMenuCounts(Object.fromEntries(firstOrderRule.menuCounts.map((menuCount) => [menuCount.menuId, menuCount.countAs])));
  }, [firstOrderRule, openState]);

  const handleClose = () => {
    if (duringConfirm) return;
    setOpenState(false);
  };

  const handleConfirm = async () => {
    if (duringConfirm) return;

    const activeMenuIds = new Set(activeMenus.map((menu) => menu.id));
    setDuringConfirm(true);
    try {
      const response = await updateFirstOrderRule({
        rule: {
          enabled,
          requiredCount,
          menuCounts: Object.entries(menuCounts)
            .filter(([menuId, countAs]) => activeMenuIds.has(menuId) && countAs !== 0)
            .map(([menuId, countAs]) => ({ menuId, countAs })),
        },
      });

      if (response) {
        setOpenState(false);
      }
    } finally {
      setDuringConfirm(false);
    }
  };

  const getCategoryName = (menuCategoryId: string) => (
    menuCategories.find((category) => category.id === menuCategoryId)?.name ?? "기타"
  );

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100">첫 주문 규칙</DialogTitle>
          <DialogDescription className="text-xs text-slate-455 dark:text-slate-300 font-semibold">
            비활성 테이블에서 첫 주문으로 테이블을 활성화할 때만 적용됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Checkbox
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(Boolean(checked))}
              disabled={duringConfirm}
            />
            규칙 사용
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="fc gap-1.5">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">필수 계산 수량</label>
              <Input
                type="number"
                min={1}
                max={999}
                value={requiredCount}
                onChange={(event) => setRequiredCount(Math.max(1, Number(event.target.value) || 1))}
                disabled={duringConfirm || !enabled}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
              />
            </div>
          </div>

          {enabled && (
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40">
                메뉴별 계산 수량
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {activeMenus.length === 0 ? (
                  <div className="p-3 text-center text-xs font-semibold text-slate-400">메뉴가 없습니다</div>
                ) : activeMenus.map((menu) => (
                  <div key={menu.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{menu.name}</div>
                      <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate">{getCategoryName(menu.menuCategoryId)}</div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={menuCounts[menu.id] ?? 0}
                      onChange={(event) => setMenuCounts((state) => ({
                        ...state,
                        [menu.id]: Math.max(0, Math.min(99, Number(event.target.value) || 0)),
                      }))}
                      disabled={duringConfirm}
                      className="w-20 h-8 rounded-lg text-xs font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 dark:border-slate-850 pt-4 flex gap-2">
          <Button onClick={handleClose} variant="outline" disabled={duringConfirm} className="rounded-xl font-bold">
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={duringConfirm} className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold">
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
