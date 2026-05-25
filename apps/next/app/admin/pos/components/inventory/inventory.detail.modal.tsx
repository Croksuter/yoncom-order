import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Menu } from "db/schema";
import useMenuStore from "~/stores/menu.store";
import { Checkbox } from "~/components/ui/checkbox";

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
  const [menuCategory, setMenuCategory] = useState(menu.menuCategoryId || "");
  const [menuDescription, setMenuDescription] = useState(menu.description || "");
  const [menuImage, setMenuImage] = useState(menu.image || "");
  const [menuPrice, setMenuPrice] = useState(menu.price || 0);
  const [menuQuantity, setMenuQuantity] = useState(menu.quantity || 0);
  const [menuAvailable, setMenuAvailable] = useState(menu.available || false);
  const [isUploading, setIsUploading] = useState(false);
  const [duringConfirm, setDuringConfirm] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const isBusy = isUploading || duringConfirm;

  const resetForm = useCallback(() => {
    setMenuName(menu.name || "");
    setMenuCategory(menu.menuCategoryId || "");
    setMenuDescription(menu.description || "");
    setMenuImage(menu.image || "");
    setMenuPrice(menu.price || 0);
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

    if (
      menuName.length === 0
      || !menuCategories.some(category => category.id === menuCategory)
    ) {
      setInvalid(true);
      return;
    }

    setDuringConfirm(true);
    try {
      await useMenuStore.getState().updateMenu({
        menuOptions: {
          name: menuName,
          menuCategoryId: menuCategory,
          description: menuDescription,
          image: menuImage,
          price: menuPrice,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`메뉴 상세 정보 - ${menu.name}`}</DialogTitle>
          <DialogDescription>메뉴와 재고 사항을 확인 및 설정합니다.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4">
          {/* 메뉴 이름 */}
          <div className="space-y-2 col-span-1 fc">
            <label className="text-sm font-medium -mb-1">이름</label>
            <Input
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              placeholder="메뉴 이름을 입력하세요"
            />
          </div>

          {/* 메뉴 카테고리 */}
          <div className="space-y-2 col-span-1 fc">
            <label className="text-sm font-medium -mb-1">카테고리</label>
            <Select value={menuCategory} onValueChange={setMenuCategory}>
              <SelectTrigger>
                <SelectValue placeholder="카테고리를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {menuCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 메뉴 이미지 */}
          <div className="space-y-2 row-span-4 fc">
            <label className="text-sm font-medium -mb-1">이미지</label>

            {/* 이미지 미리보기 */}
            <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
              {menuImage ? (
                <img
                  src={menuImage}
                  alt="메뉴 이미지"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <svg className="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs">이미지 없음</p>
                </div>
              )}
            </div>

            {/* 파일 업로드 버튼 */}
            <div className="relative cursor-pointer">
              <input
                id="image-upload"
                onChange={handleImageUpload}
                type="file"
                accept="image/*"
                disabled={isBusy}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className={`
                w-full px-4 py-2 border-2 border-dashed rounded-lg text-center transition-colors
                ${isUploading
                  ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                  : 'border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 cursor-pointer'
                }
              `}>
                {isUploading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-sm text-gray-600">업로드 중...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-blue-600 font-medium">
                      {menuImage ? '이미지 변경' : '이미지 업로드'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 파일 형식 안내 */}
            <p className="text-xs text-gray-500 text-center">
              JPG, PNG, GIF 파일만 업로드 가능 (최대 5MB)
            </p>
          </div>

          {/* 메뉴 카테고리 */}
          <div className="space-y-2 col-span-2 fc">
            <label className="text-sm font-medium -mb-1">카테고리</label>
            <Select value={menuCategory} onValueChange={setMenuCategory}>
              <SelectTrigger>
                <SelectValue placeholder="카테고리를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {menuCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 메뉴 설명 */}
          <div className="space-y-2 col-span-2 fc">
            <label className="text-sm font-medium -mb-1">설명</label>
            <Input
              value={menuDescription}
              onChange={(e) => setMenuDescription(e.target.value)}
              placeholder="메뉴 설명을 입력하세요"
            />
          </div>

          {/* 메뉴 가격 */}
          <div className="space-y-2 fc">
            <label className="text-sm font-medium -mb-1">가격 (원)</label>
            <Input
              type="number"
              value={menuPrice}
              min={0}
              step={100}
              onChange={(e) => setMenuPrice(Number(e.target.value))}
              placeholder="가격을 입력하세요"
            />
          </div>

          {/* 메뉴 재고 */}
          <div className="space-y-2 fc">
            <label className="text-sm font-medium -mb-1">재고 수량</label>
            <Input
              type="number"
              value={menuQuantity}
              min={0}
              onChange={(e) => setMenuQuantity(Number(e.target.value))}
              placeholder="재고 수량을 입력하세요"
            />
          </div>

          {/* 메뉴 활성화 */}
          <div className="space-y-2 fc">
            <label className="text-sm font-medium -mb-1">활성화</label>
            <Checkbox
              checked={menuAvailable}
              onCheckedChange={(checked: boolean | "indeterminate") => setMenuAvailable(checked === "indeterminate" ? false : checked === true)}
            />
          </div>
        </div>


        <DialogDescription className={`-mt-2 text-right ${invalid ? "dangerTXT" : "hidden"}`}>⚠︎ 올바른 이름과 카테고리를 입력하세요.</DialogDescription>
        <DialogFooter className="">
          <Button onClick={handleConfirm} className="dangerBG dangerB" disabled={isBusy}>
            {duringConfirm ? "처리 중..." : "저장"}
          </Button>
          <Button onClick={handleClose} disabled={isBusy}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}
