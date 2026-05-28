import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Menu } from "db/schema";
import useMenuStore from "~/stores/menu.store";
import { Checkbox } from "~/components/ui/checkbox";
import { Image, UploadCloud } from "lucide-react";

function safeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function formatWon(value: number) {
  return `₩${Math.round(safeNumber(value)).toLocaleString()}`;
}

function fallbackUnitCost(price: number) {
  return Math.floor(Math.max(0, safeNumber(price)) / 3);
}

export default function InventoryDetailModal({
  openState, setOpenState,
  menu,
}: {
  openState: boolean;
  setOpenState: any;
  menu: Menu;
}) {
  const { menuCategories } = useMenuStore();

  const [menuName, setMenuName] = useState(menu.name || "");
  const [menuNameEn, setMenuNameEn] = useState(menu.nameEn || "");
  const [menuCategory, setMenuCategory] = useState(menu.menuCategoryId || "");
  const [menuDescription, setMenuDescription] = useState(menu.description || "");
  const [menuDescriptionEn, setMenuDescriptionEn] = useState(menu.descriptionEn || "");
  const [menuImage, setMenuImage] = useState(menu.image || "");
  const [menuPrice, setMenuPrice] = useState(menu.price || 0);
  const [menuUnitCost, setMenuUnitCost] = useState(menu.unitCost === null || menu.unitCost === undefined ? "" : String(menu.unitCost));
  const [menuQuantity, setMenuQuantity] = useState(menu.quantity || 0);
  const [menuAvailable, setMenuAvailable] = useState(menu.available || false);
  const [isUploading, setIsUploading] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const isBusy = isUploading || duringConfirm;

  const resetForm = useCallback(() => {
    setMenuName(menu.name || "");
    setMenuNameEn(menu.nameEn || "");
    setMenuCategory(menu.menuCategoryId || "");
    setMenuDescription(menu.description || "");
    setMenuDescriptionEn(menu.descriptionEn || "");
    setMenuImage(menu.image || "");
    setMenuPrice(menu.price || 0);
    setMenuUnitCost(menu.unitCost === null || menu.unitCost === undefined ? "" : String(menu.unitCost));
    setMenuQuantity(menu.quantity || 0);
    setMenuAvailable(menu.available || false);
    setInvalid(false);
  }, [menu]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await useMenuStore.getState().uploadImage(file);
      if (response) {
        setMenuImage(response.filename);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (isBusy) return;

    const unitCost = menuUnitCost.trim().length > 0 ? Number(menuUnitCost) : null;
    if (
      menuName.length === 0
      || !menuCategories.some(category => category.id === menuCategory)
      || (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0))
    ) {
      setInvalid(true);
      return;
    }

    setDuringConfirm(true);
    try {
      await useMenuStore.getState().updateMenu({
        menuOptions: {
          name: menuName,
          nameEn: menuNameEn.trim() || null,
          menuCategoryId: menuCategory,
          description: menuDescription,
          descriptionEn: menuDescriptionEn.trim() || null,
          image: menuImage,
          price: menuPrice,
          unitCost,
          quantity: menuQuantity,
          available: menuAvailable,
        },
        menuId: menu.id,
      });
      setInvalid(false);
      setOpenState(false);
    } finally {
      setDuringConfirm(false);
    }
  }

  const handleClose = () => {
    if (isBusy) return;
    resetForm();
    setOpenState(false);
  }

  useEffect(() => {
    if (openState) {
      resetForm();
    }
  }, [openState, resetForm]);

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[calc(100vh-100px)] max-w-2xl flex-col overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6">
        <DialogHeader className="w-full">
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center justify-between">
            <span>메뉴 상세 및 재고 설정</span>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-300 mr-6">
              메뉴 고유코드: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold">#{menu.id.slice(-6).toUpperCase()}</span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-455 dark:text-slate-300 font-semibold">
            메뉴 정보와 실시간 재고 사양을 업데이트하고 활성화 여부를 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {/* Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">

          {/* Left Column (Inputs) - span-2 */}
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="fc gap-1.5">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">메뉴 이름 (한국어)</label>
              <Input
                value={menuName}
                onChange={(e) => setMenuName(e.target.value)}
                placeholder="메뉴 이름을 입력하세요"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                disabled={isBusy}
              />
            </div>

            <div className="fc gap-1.5">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">Menu Name (English)</label>
              <Input
                value={menuNameEn}
                onChange={(e) => setMenuNameEn(e.target.value)}
                placeholder="Enter menu name in English"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                disabled={isBusy}
              />
            </div>

            <div className="fc gap-1.5">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">카테고리</label>
              <Select value={menuCategory} onValueChange={setMenuCategory} disabled={isBusy}>
                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm">
                  <SelectValue placeholder="카테고리를 선택하세요" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl">
                  {menuCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="fc gap-1.5">
              <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">메뉴 설명 (한국어)</label>
              <Input
                value={menuDescription}
                onChange={(e) => setMenuDescription(e.target.value)}
                placeholder="간단한 메뉴 설명을 입력하세요"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                disabled={isBusy}
              />
            </div>

            <div className="fc gap-1.5">
              <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">Menu Description (English)</label>
              <Input
                value={menuDescriptionEn}
                onChange={(e) => setMenuDescriptionEn(e.target.value)}
                placeholder="Enter menu description in English"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                disabled={isBusy}
              />
            </div>

            {/* Price & Quantity Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="fc gap-1.5">
                <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">단가 (원)</label>
                <Input
                  type="number"
                  value={menuPrice}
                  min={0}
                  step={100}
                  onChange={(e) => setMenuPrice(Number(e.target.value))}
                  placeholder="단가 입력"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                  disabled={isBusy}
                />
              </div>

              <div className="fc gap-1.5">
                <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">원가 (선택)</label>
                <Input
                  type="number"
                  value={menuUnitCost}
                  min={0}
                  step={100}
                  onChange={(e) => setMenuUnitCost(e.target.value)}
                  placeholder={`${formatWon(fallbackUnitCost(menuPrice))} 자동`}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                  disabled={isBusy}
                />
              </div>

              <div className="fc gap-1.5">
                <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">재고 수량</label>
                <Input
                  type="number"
                  value={menuQuantity}
                  min={0}
                  onChange={(e) => setMenuQuantity(Number(e.target.value))}
                  placeholder="재고 수량 입력"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                  disabled={isBusy}
                />
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              적용 원가 {formatWon(menuUnitCost.trim().length > 0 ? Number(menuUnitCost) || 0 : fallbackUnitCost(menuPrice))}
              {menuUnitCost.trim().length === 0 && " · 정가/3 자동"}
            </div>

            {/* Available Toggle Checkbox */}
            <label className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between gap-3 cursor-pointer select-none">
              <div className="fc">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">주문 접수 활성화</span>
                <span className="text-xs text-slate-450 dark:text-slate-300 font-medium mt-0.5">체크 시 고객 주문 목록에 노출되고 접수가 가능해집니다.</span>
              </div>
              <Checkbox
                checked={menuAvailable}
                onCheckedChange={(checked: boolean | "indeterminate") => setMenuAvailable(checked === "indeterminate" ? false : checked === true)}
                className="h-5 w-5 rounded-md border-slate-300 dark:border-slate-700 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500 transition-colors"
                disabled={isBusy}
              />
            </label>
          </div>

          {/* Right Column (Image Upload) - span-1 */}
          <div className="col-span-1 flex flex-col gap-3">
            <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">메뉴 이미지</label>

            {/* Image Preview Container */}
            <div className="w-full aspect-square border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-center relative group shadow-inner">
              {menuImage ? (
                <>
                  <img
                    src={menuImage}
                    alt="메뉴 미리보기"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </>
              ) : (
                <div className="text-center text-slate-400 p-4">
                  <Image className="mx-auto h-10 w-10 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold">등록된 이미지 없음</p>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="relative">
              <input
                id="image-upload-detail"
                onChange={handleImageUpload}
                type="file"
                accept="image/*"
                disabled={isBusy}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              />
              <div className={`
                w-full px-4 py-2.5 border border-dashed rounded-xl text-center transition-all duration-300 flex items-center justify-center gap-2
                ${isUploading
                  ? 'border-slate-250 bg-slate-100 dark:bg-slate-850 cursor-not-allowed'
                  : 'border-brand-300 bg-brand-50/20 hover:border-brand-400 hover:bg-brand-50/45 dark:border-brand-900/40 dark:bg-brand-950/10 cursor-pointer shadow-sm'
                }
              `}>
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-500"></div>
                    <span className="text-xs font-bold text-slate-500">업로드 중...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4.5 w-4.5 text-brand-500" />
                    <span className="text-xs font-bold text-brand-650 dark:text-brand-700">
                      {menuImage ? '이미지 변경하기' : '신규 이미지 업로드'}
                    </span>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-300 font-medium text-center mt-1 leading-normal">
              JPG, PNG, GIF 파일 가능 (최대 5MB)
            </p>
          </div>
        </div>

        {invalid && (
          <p className="text-rose-500 dark:text-rose-455 text-xs font-semibold px-0.5 flex items-center gap-1.5 animate-pulse mt-2">
            ⚠️ 메뉴 명칭, 카테고리, 원가 값을 확인해 주세요.
          </p>
        )}
        </div>

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
            disabled={isBusy}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm px-6 h-10 transition-all shadow-sm border-none shadow-emerald-500/10"
          >
            {duringConfirm ? "저장 중..." : "설정 저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
