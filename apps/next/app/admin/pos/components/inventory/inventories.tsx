import { useState } from "react";
import useMenuStore from "~/stores/menu.store";
import InventoryDetailModal from "./inventory.detail.modal";
import { Menu } from "db/schema";
import { Button } from "~/components/ui/button";
import MenuManageModal from "./menu.manage.modal";
import CategoryManageModal from "./category.manage.modal";

export default function Inventories() {
  const [menuDetail, setMenuDetail] = useState<Menu | null>(null);
  const [menuDetailModalOpenState, setMenuDetailModalOpenState] = useState(false);
  const { menus, menuCategories } = useMenuStore();

  const [menuManageModalOpen, setMenuManageModalOpen] = useState(false);
  const [categoryManageModalOpen, setCategoryManageModalOpen] = useState(false);

  const activeMenus = menus.filter((menu) => menu?.deletedAt === null);

  const dangerCount = activeMenus.filter(
    (menu) => menu.quantity === 0 || menu.available === false
  ).length;

  const cautionCount = activeMenus.filter(
    (menu) => menu.quantity <= 15 && menu.quantity > 0 && menu.available !== false
  ).length;

  const goodCount = activeMenus.filter(
    (menu) => menu.quantity > 15 && menu.available !== false
  ).length;

  return (
    <div className="full p-2 h-full">
      <div className="full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-md rounded-3xl flex flex-col overflow-hidden">
        {/* Header Block */}
        <div className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col px-4 py-3 shrink-0 gap-3">
          <div className="flex justify-between items-center w-full">
            <h3 className="font-extrabold text-base text-slate-800 dark:text-white leading-none">
              재고 현황
            </h3>
            {/* Status indicators */}
            <div className="flex gap-3 text-xs font-black text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5" title="좋음">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>{goodCount}</span>
              </span>
              <span className="flex items-center gap-1.5" title="주의">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>{cautionCount}</span>
              </span>
              <span className="flex items-center gap-1.5" title="위험 (품절/비활성화)">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>{dangerCount}</span>
              </span>
            </div>
          </div>

          {/* Action Button Groups (Merged cleanly underneath!) */}
          <div className="flex items-center gap-2 w-full">
            <Button
              size="sm"
              className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs h-8 px-4 flex-1 rounded-xl shadow-sm shadow-brand-500/10 transition-all border-none"
              onClick={() => setMenuManageModalOpen(true)}
            >
              메뉴 추가/제거
            </Button>
            <Button
              size="sm"
              className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs h-8 px-4 flex-1 rounded-xl shadow-sm shadow-brand-500/10 transition-all border-none"
              onClick={() => setCategoryManageModalOpen(true)}
            >
              카테고리 추가/제거
            </Button>
          </div>
        </div>

        {/* Inventory Table Block */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/60">
                <th className="font-bold text-xs text-slate-400 dark:text-slate-500 px-4 py-3 text-start">메뉴</th>
                <th className="font-bold text-xs text-slate-400 dark:text-slate-500 px-4 py-3 text-center">카테고리</th>
                <th className="font-bold text-xs text-slate-400 dark:text-slate-500 px-4 py-3 text-end">재고</th>
              </tr>
            </thead>
            <tbody>
              {menus
                .filter((menu) => menu?.deletedAt === null)
                .sort((a, b) => menuCategories.find((category) => category.id === a.menuCategoryId)?.name.localeCompare(menuCategories.find((category) => category.id === b.menuCategoryId)?.name ?? "") ?? 0)
                .map((menu) => {
                  const isLowStock = menu.quantity <= 15 && menu.quantity > 0;
                  const isOutOfStock = menu.quantity === 0 || menu.available === false;

                  return (
                    <tr
                      key={menu.id}
                      className="border-b border-slate-50 dark:border-slate-800/30 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 hover:cursor-pointer transition-colors duration-200"
                      onClick={() => {
                        setMenuDetail(menu);
                        setMenuDetailModalOpenState(true);
                      }}
                      style={{
                        opacity: isOutOfStock ? 0.35 : 1,
                      }}
                    >
                      <td className="px-4 py-3.5 text-start text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[120px]">
                        <span className="truncate block w-full">{menu.name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 text-xs font-bold px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-750">
                          {menuCategories.find((category) => category.id === menu.menuCategoryId)?.name ?? "기타"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-end">
                        <span className={`text-md font-black ${
                          isOutOfStock
                            ? "text-rose-500 dark:text-rose-455"
                            : isLowStock
                              ? "text-amber-500 dark:text-amber-400 font-extrabold"
                              : "text-emerald-500 dark:text-emerald-400"
                        }`}>
                          {menu.quantity === 0 ? "품절" : menu.quantity}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {menuDetail && (
        <InventoryDetailModal
          menu={menuDetail}
          openState={menuDetailModalOpenState}
          setOpenState={setMenuDetailModalOpenState}
        />
      )}
      <MenuManageModal
        openState={menuManageModalOpen}
        setOpenState={setMenuManageModalOpen}
      />
      <CategoryManageModal
        openState={categoryManageModalOpen}
        setOpenState={setCategoryManageModalOpen}
      />
    </div>
  );
}
