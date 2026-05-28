import { useState, useCallback, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import useMenuStore from "~/stores/menu.store";
import { Checkbox } from "~/components/ui/checkbox";
import { Image, UploadCloud, Plus, Trash2 } from "lucide-react";

type MenuManageTab = "create" | "remove";

function safeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function formatWon(value: number) {
  return `₩${Math.round(safeNumber(value)).toLocaleString()}`;
}

function fallbackUnitCost(price: number) {
  return Math.floor(Math.max(0, safeNumber(price)) / 3);
}

export default function MenuManageModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: any;
}) {
  const [activeTab, setActiveTab] = useState<MenuManageTab>("create");
  const { menuCategories, menus, createMenu, removeMenu } = useMenuStore();

  // Create Form State
  const [menuName, setMenuName] = useState("");
  const [menuNameEn, setMenuNameEn] = useState("");
  const [menuCategory, setMenuCategory] = useState("");
  const [menuDescription, setMenuDescription] = useState("");
  const [menuDescriptionEn, setMenuDescriptionEn] = useState("");
  const [menuImage, setMenuImage] = useState("");
  const [menuPrice, setMenuPrice] = useState(0);
  const [menuUnitCost, setMenuUnitCost] = useState("");
  const [menuQuantity, setMenuQuantity] = useState(0);
  const [menuAvailable, setMenuAvailable] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Remove Form State
  const [removeMenuId, setRemoveMenuId] = useState<string>("");

  // Common State
  const [invalid, setInvalid] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);
  const isBusy = isUploading || duringConfirm;

  const resetCreateForm = useCallback(() => {
    setMenuName("");
    setMenuNameEn("");
    setMenuCategory("");
    setMenuDescription("");
    setMenuDescriptionEn("");
    setMenuImage("");
    setMenuPrice(0);
    setMenuUnitCost("");
    setMenuQuantity(0);
    setMenuAvailable(true);
    setInvalid(false);
  }, []);

  const resetRemoveForm = useCallback(() => {
    setRemoveMenuId("");
    setInvalid(false);
  }, []);

  // Handle image upload for creation form
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

  // Confirm Actions
  const handleConfirm = async () => {
    if (isBusy) return;

    if (activeTab === "create") {
      const createUnitCost = menuUnitCost.trim().length > 0 ? Number(menuUnitCost) : null;
      if (
        menuName.length === 0
        || !menuCategories.some(category => category.id === menuCategory)
        || (createUnitCost !== null && (!Number.isFinite(createUnitCost) || createUnitCost < 0))
      ) {
        setInvalid(true);
        return;
      }

      setDuringConfirm(true);
      try {
        await createMenu({
          menuOptions: {
            name: menuName,
            nameEn: menuNameEn.trim() || null,
            description: menuDescription,
            descriptionEn: menuDescriptionEn.trim() || null,
            image: menuImage,
            price: menuPrice,
            unitCost: createUnitCost,
            quantity: menuQuantity,
            available: menuAvailable,
            menuCategoryId: menuCategory,
          },
        });
        resetCreateForm();
        setOpenState(false);
      } finally {
        setDuringConfirm(false);
      }
    } else if (activeTab === "remove") {
      if (removeMenuId.length === 0) {
        setInvalid(true);
        return;
      }

      setDuringConfirm(true);
      try {
        await removeMenu({ menuId: removeMenuId });
        resetRemoveForm();
        setOpenState(false);
      } finally {
        setDuringConfirm(false);
      }
    }
  };

  const handleClose = () => {
    if (isBusy) return;
    resetCreateForm();
    resetRemoveForm();
    setOpenState(false);
  };

  // Reset states when switching tabs
  useEffect(() => {
    setInvalid(false);
  }, [activeTab]);

  const deletableMenus = menus
    .filter((menu) => menu?.deletedAt === null)
    .filter((menu) => !menu.available); // Safety rule: only non-active menus can be deleted

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[calc(100vh-100px)] max-w-2xl flex-col overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6">
        <DialogHeader className="w-full">
          <div className="flex justify-between items-center mr-6">
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100">메뉴 관리</DialogTitle>

            {/* Custom Premium Segmented Tab Selector */}
            <div className="bg-slate-100/80 dark:bg-slate-800/60 p-0.5 rounded-lg flex border border-slate-200/20 dark:border-slate-800/40">
              {[
                { id: "create" as const, label: "메뉴 추가", icon: Plus, activeClass: "text-brand-500", hoverClass: "hover:text-slate-650" },
                { id: "remove" as const, label: "메뉴 제거", icon: Trash2, activeClass: "text-rose-500", hoverClass: "hover:text-rose-450" },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      activeTab === tab.id
                        ? `bg-white dark:bg-slate-900 ${tab.activeClass} shadow-sm`
                        : `text-slate-400 dark:text-slate-300 ${tab.hoverClass}`
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                    disabled={isBusy}
                  >
                    <Icon className="h-3 w-3" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-400 dark:text-slate-300 font-semibold mt-1">
            {activeTab === "create"
              ? "매장에서 신규 판매할 신규 메뉴와 기본 가격, 재고 정보를 입력합니다."
              : "안전하게 비활성화된 메뉴를 목록에서 영구적으로 제거합니다."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab content conditional rendering */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {activeTab === "create" ? (
          /* ================== MENU CREATE TAB ================== */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
            {/* Left Column inputs */}
            <div className="col-span-1 md:col-span-2 space-y-4">
              <div className="fc gap-1.5">
                <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">메뉴 이름 (한국어)</label>
                <Input
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  placeholder="예: 후라이드 치킨, 타코야끼"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                  disabled={isBusy}
                />
              </div>

              <div className="fc gap-1.5">
                <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">Menu Name (English)</label>
                <Input
                  value={menuNameEn}
                  onChange={(e) => setMenuNameEn(e.target.value)}
                  placeholder="e.g. Fried Chicken, Takoyaki"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                  disabled={isBusy}
                />
              </div>

              <div className="fc gap-1.5">
                <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">카테고리</label>
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
                  placeholder="Enter a simple description in English"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                  disabled={isBusy}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="fc gap-1.5">
                  <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">단가 (원)</label>
                  <Input
                    type="number"
                    value={menuPrice === 0 ? "" : menuPrice}
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
                  <label className="text-xs uppercase font-bold text-slate-455 dark:text-slate-300 px-0.5">최초 재고 수량</label>
                  <Input
                    type="number"
                    value={menuQuantity === 0 ? "" : menuQuantity}
                    min={0}
                    onChange={(e) => setMenuQuantity(Number(e.target.value))}
                    placeholder="초기 재고 입력"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm"
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                적용 원가 {formatWon(menuUnitCost.trim().length > 0 ? Number(menuUnitCost) || 0 : fallbackUnitCost(menuPrice))}
                {menuUnitCost.trim().length === 0 && " · 원가 미입력 시 정가/3 자동 적용"}
              </div>

              <label className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between gap-3 cursor-pointer select-none">
                <div className="fc">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">주문 접수 바로 활성화</span>
                  <span className="text-xs text-slate-450 dark:text-slate-300 font-medium mt-0.5">메뉴 생성 즉시 매장 주문 목록에 노출하도록 설정합니다.</span>
                </div>
                <Checkbox
                  checked={menuAvailable}
                  onCheckedChange={(checked: boolean | "indeterminate") => setMenuAvailable(checked === "indeterminate" ? false : checked === true)}
                  className="h-5 w-5 rounded-md border-slate-300 dark:border-slate-700 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500 transition-colors"
                  disabled={isBusy}
                />
              </label>
            </div>

            {/* Right Column (Image upload) */}
            <div className="col-span-1 flex flex-col gap-3">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">메뉴 이미지</label>

              <div className="w-full aspect-square border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-center relative group shadow-inner">
                {menuImage ? (
                  <>
                    <img
                      src={menuImage}
                      alt="메뉴 이미지"
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

              <div className="relative">
                <input
                  id="image-upload-manage"
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
                        {menuImage ? '이미지 변경하기' : '이미지 업로드'}
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
        ) : (
          /* ================== MENU REMOVE TAB ================== */
          <div className="space-y-4 my-6 fc">
            <div className="fc gap-1.5 w-full">
              <label className="text-xs uppercase font-bold text-slate-450 dark:text-slate-300 px-0.5">제거 대상 메뉴 선택</label>
              <Select value={removeMenuId} onValueChange={setRemoveMenuId} disabled={isBusy}>
                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 font-medium text-sm focus:ring-rose-500">
                  <SelectValue placeholder="제거할 메뉴를 선택하세요" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  {deletableMenus.length === 0 ? (
                    <div className="p-3 text-center text-xs font-semibold text-slate-400">제거 가능한 비활성 메뉴가 없습니다</div>
                  ) : (
                    deletableMenus.map((menu) => (
                      <SelectItem key={menu.id} value={menu.id} className="font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                        {menu.name} ({menuCategories.find((cat) => cat.id === menu.menuCategoryId)?.name ?? "기타"})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-100/30 dark:border-rose-900/30 text-xs font-medium leading-relaxed flex items-start gap-2">
              <span className="text-base select-none leading-none">💡</span>
              <span>
                <strong>안전 제어 수칙:</strong> 현재 노출/판매 중(`주문 접수 활성화` 체크된 상태)인 메뉴는 실수로 삭제하여 주문 연계가 깨지는 사고를 막기 위해 표시되지 않습니다. 해당 메뉴 상세 모달에서 `주문 접수 활성화` 체크 해제 후 진행해 주세요.
              </span>
            </div>
          </div>
        )}
        </div>

        {invalid && (
          <p className="text-rose-500 dark:text-rose-455 text-xs font-semibold px-0.5 flex items-center gap-1.5 animate-pulse">
            {activeTab === "create"
              ? "⚠️ 메뉴 명칭과 유효한 카테고리를 반드시 지정해야 추가할 수 있습니다."
              : "⚠️ 제거 대상을 반드시 지정해 주세요."}
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
            disabled={isBusy || (activeTab === "remove" && deletableMenus.length === 0)}
            className={`font-bold text-sm px-6 h-10 transition-all shadow-sm border-none text-white ${
              activeTab === "create"
                ? "bg-brand-500 hover:bg-brand-600 shadow-brand-500/10"
                : "bg-rose-500 hover:bg-rose-600 shadow-rose-500/10"
            }`}
          >
            {duringConfirm
              ? "처리 중..."
              : activeTab === "create"
                ? "확인 및 추가"
                : "확인 및 제거"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
