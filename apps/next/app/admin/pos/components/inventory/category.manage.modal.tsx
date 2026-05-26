import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useMenuStore from "~/stores/menu.store";
import { Plus, Trash2, Pencil } from "lucide-react";

export default function CategoryManageModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: any;
}) {
  const [activeTab, setActiveTab] = useState<"create" | "remove" | "edit">("create");
  const { menus, menuCategories, createMenuCategory, removeMenuCategory, updateMenuCategory } = useMenuStore();

  // Create Form State
  const [categoryName, setCategoryName] = useState<string>("");
  const [categoryNameEn, setCategoryNameEn] = useState<string>("");

  // Edit Form State
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editCategoryName, setEditCategoryName] = useState<string>("");
  const [editCategoryNameEn, setEditCategoryNameEn] = useState<string>("");

  // Remove Form State
  const [removeCategoryId, setRemoveCategoryId] = useState<string>("");

  // Common State
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);
  const isBusy = duringConfirm;

  const getMenuCount = (categoryId: string) => {
    return menus.filter(
      (menu) => menu?.deletedAt === null && menu.menuCategoryId === categoryId
    ).length;
  };

  const handleConfirm = async () => {
    if (isBusy) return;

    if (activeTab === "create") {
      if (categoryName.trim().length === 0) {
        setInvalid(true);
        return;
      }

      setDuringConfirm(true);
      try {
        await createMenuCategory({
          menuCategoryOptions: {
            name: categoryName.trim(),
            nameEn: categoryNameEn.trim() || null,
            description: "",
            descriptionEn: "",
          }
        });
        setCategoryName("");
        setCategoryNameEn("");
        setInvalid(false);
        setOpenState(false);
      } finally {
        setDuringConfirm(false);
      }
    } else if (activeTab === "edit") {
      if (editCategoryId.length === 0 || editCategoryName.trim().length === 0) {
        setInvalid(true);
        return;
      }

      setDuringConfirm(true);
      try {
        await updateMenuCategory({
          menuCategoryId: editCategoryId,
          menuCategoryOptions: {
            name: editCategoryName.trim(),
            nameEn: editCategoryNameEn.trim() || null,
            description: "",
            descriptionEn: "",
          }
        });
        setEditCategoryId("");
        setEditCategoryName("");
        setEditCategoryNameEn("");
        setInvalid(false);
        setOpenState(false);
      } finally {
        setDuringConfirm(false);
      }
    } else {
      if (removeCategoryId.length === 0) {
        setInvalid(true);
        return;
      }

      const hasMenus = getMenuCount(removeCategoryId) > 0;
      if (hasMenus) {
        setInvalid(true);
        return;
      }

      setDuringConfirm(true);
      try {
        await removeMenuCategory({ menuCategoryId: removeCategoryId });
        setRemoveCategoryId("");
        setInvalid(false);
        setOpenState(false);
      } finally {
        setDuringConfirm(false);
      }
    }
  };

  const handleClose = () => {
    if (isBusy) return;
    setCategoryName("");
    setCategoryNameEn("");
    setRemoveCategoryId("");
    setEditCategoryId("");
    setEditCategoryName("");
    setEditCategoryNameEn("");
    setInvalid(false);
    setOpenState(false);
  };

  // Reset validation state when switching tabs
  useEffect(() => {
    setInvalid(false);
  }, [activeTab]);

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        <DialogHeader className="w-full">
          <div className="flex justify-between items-center mr-6">
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100">카테고리 관리</DialogTitle>

            {/* Custom Premium Segmented Tab Selector */}
            <div className="bg-slate-100/80 dark:bg-slate-800/60 p-0.5 rounded-lg flex border border-slate-200/20 dark:border-slate-800/40">
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  activeTab === "create"
                    ? "bg-white dark:bg-slate-900 text-brand-500 shadow-sm"
                    : "text-slate-400 dark:text-slate-300 hover:text-slate-650"
                }`}
                onClick={() => setActiveTab("create")}
                disabled={isBusy}
              >
                <Plus className="h-3 w-3" />
                추가
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  activeTab === "edit"
                    ? "bg-white dark:bg-slate-900 text-amber-500 shadow-sm"
                    : "text-slate-400 dark:text-slate-300 hover:text-amber-455"
                }`}
                onClick={() => setActiveTab("edit")}
                disabled={isBusy}
              >
                <Pencil className="h-3 w-3" />
                수정
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  activeTab === "remove"
                    ? "bg-white dark:bg-slate-900 text-rose-500 shadow-sm"
                    : "text-slate-400 dark:text-slate-300 hover:text-rose-455"
                }`}
                onClick={() => setActiveTab("remove")}
                disabled={isBusy}
              >
                <Trash2 className="h-3 w-3" />
                제거
              </button>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-400 dark:text-slate-300 font-semibold mt-1">
            {activeTab === "create"
              ? "새로운 메뉴들을 분류할 카테고리 명칭을 등록합니다."
              : activeTab === "edit"
                ? "선택한 카테고리의 이름을 변경하여 실시간으로 수정합니다."
                : "내부에 속해있는 메뉴가 없는 비어있는 카테고리를 영구 제거합니다."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab content conditional rendering */}
        {activeTab === "create" ? (
          /* ================== CATEGORY CREATE TAB ================== */
          <div className="space-y-4 my-4">
            <div className="fc gap-1.5">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">카테고리 이름 (한국어)</label>
              <Input
                type="text"
                placeholder="예: 주류, 사이드 메뉴, 메인 안주"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                disabled={isBusy}
              />
            </div>
            <div className="fc gap-1.5">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">Category Name (English)</label>
              <Input
                type="text"
                placeholder="e.g. Drinks, Side Dishes, Main Menu"
                value={categoryNameEn}
                onChange={(e) => setCategoryNameEn(e.target.value)}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                disabled={isBusy}
              />
            </div>
          </div>
        ) : activeTab === "edit" ? (
          /* ================== CATEGORY EDIT TAB ================== */
          <div className="space-y-4 my-4 fc">
            <div className="fc gap-1.5 w-full">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">수정할 카테고리 선택</label>
              <Select
                value={editCategoryId}
                onValueChange={(id) => {
                  setEditCategoryId(id);
                  const cat = menuCategories.find(c => c.id === id);
                  setEditCategoryName(cat ? cat.name : "");
                  setEditCategoryNameEn(cat ? (cat.nameEn || "") : "");
                }}
                disabled={isBusy}
              >
                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:ring-amber-500">
                  <SelectValue placeholder="수정할 카테고리를 선택하세요" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  {menuCategories.length === 0 ? (
                    <div className="p-3 text-center text-xs font-semibold text-slate-400">등록된 카테고리가 없습니다</div>
                  ) : (
                    menuCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id} className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                        {category.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {editCategoryId && (
              <>
                <div className="fc gap-1.5 w-full animate-fade-in">
                  <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">새로운 카테고리 이름 (한국어)</label>
                  <Input
                    type="text"
                    placeholder="새로운 이름 입력"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:border-amber-500 focus:ring-amber-500"
                    disabled={isBusy}
                  />
                </div>
                <div className="fc gap-1.5 w-full animate-fade-in">
                  <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">New Category Name (English)</label>
                  <Input
                    type="text"
                    placeholder="Enter new English name"
                    value={editCategoryNameEn}
                    onChange={(e) => setEditCategoryNameEn(e.target.value)}
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:border-amber-500 focus:ring-amber-500"
                    disabled={isBusy}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          /* ================== CATEGORY REMOVE TAB ================== */
          <div className="space-y-4 my-4 fc">
            <div className="fc gap-1.5 w-full">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">제거 대상 카테고리 선택</label>
              <Select value={removeCategoryId} onValueChange={setRemoveCategoryId} disabled={isBusy}>
                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:ring-rose-500">
                  <SelectValue placeholder="제거할 카테고리를 선택하세요" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  {menuCategories.length === 0 ? (
                    <div className="p-3 text-center text-xs font-semibold text-slate-400">등록된 카테고리가 없습니다</div>
                  ) : (
                    menuCategories.map((category) => {
                      const menuCount = getMenuCount(category.id);
                      const hasMenus = menuCount > 0;
                      return (
                        <SelectItem
                          key={category.id}
                          value={category.id}
                          disabled={hasMenus}
                          className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {category.name} {hasMenus ? `(메뉴 ${menuCount}개 등록됨 - 삭제 불가)` : '(비어있음 - 삭제 가능)'}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-100/30 dark:border-rose-900/30 text-xs font-medium leading-relaxed flex items-start gap-2">
              <span className="text-base select-none leading-none">⚠️</span>
              <span>
                <strong>안전 제어 수칙:</strong> 내부에 연계된 실시간 메뉴가 등록된 카테고리는 삭제가 잠금처리 됩니다. 내부 메뉴를 먼저 다른 카테고리로 변경하시거나 제거한 후 진행해 주세요.
              </span>
            </div>
          </div>
        )}

        {invalid && (
          <p className="text-rose-500 dark:text-rose-455 text-xs font-semibold px-0.5 flex items-center gap-1.5 animate-pulse">
            {activeTab === "create"
              ? "⚠️ 카테고리 이름을 반드시 입력해야 합니다."
              : activeTab === "edit"
                ? "⚠️ 수정 대상 카테고리와 변경할 이름을 모두 입력해 주세요."
                : "⚠️ 비어있는 제거 대상 카테고리를 반드시 지정해야 합니다."}
          </p>
        )}

        {/* Footer Actions */}
        <DialogFooter className="border-t border-slate-100 dark:border-slate-850 pt-4 flex gap-2">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={isBusy}
            className="border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm px-5 h-10 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850"
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isBusy || (activeTab === "remove" && (removeCategoryId.length === 0 || getMenuCount(removeCategoryId) > 0)) || (activeTab === "edit" && (editCategoryId.length === 0 || editCategoryName.trim().length === 0))}
            className={`font-bold text-sm px-6 h-10 transition-all shadow-sm border-none text-white ${
              activeTab === "create"
                ? "bg-brand-500 hover:bg-brand-600 shadow-brand-500/10"
                : activeTab === "edit"
                  ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/10"
                  : "bg-rose-500 hover:bg-rose-600 shadow-rose-500/10"
            }`}
          >
            {duringConfirm
              ? "처리 중..."
              : activeTab === "create"
                ? "확인 및 추가"
                : activeTab === "edit"
                  ? "확인 및 수정"
                  : "확인 및 제거"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
