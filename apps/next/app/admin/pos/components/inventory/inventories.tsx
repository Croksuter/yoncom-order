import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import useMenuStore from "~/stores/menu.store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import InventoryDetailModal from "./inventory.detail.modal";
import { Menu } from "db/schema";
import { Button } from "~/components/ui/button";
import InventoryCreateModal from "./inventory.create.modal";
import InventoryRemoveModal from "./inventory.remove.modal";

export default function Inventories() {
  const [menuDetail, setMenuDetail] = useState<Menu | null>(null);
  const [menuDetailModalOpenState, setMenuDetailModalOpenState] = useState(false);
  const { menus, menuCategories } = useMenuStore();

  const [createMenuModalOpen, setCreateMenuModalOpen] = useState(false);
  const [removeMenuModalOpen, setRemoveMenuModalOpen] = useState(false);

  return (
    <div className="full p-2 h-full">
      <div className="full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-md rounded-3xl flex flex-col overflow-hidden">
        {/* Header Block */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-800/60 flex justify-between items-center flex-shrink-0">
          <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
            재고 현황
          </h3>
          <div className="flex gap-2">
            <Button 
              size="sm"
              className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs h-8 px-3 rounded-xl transition-all shadow-sm shadow-brand-500/10 shrink-0" 
              onClick={() => setCreateMenuModalOpen(true)}
            >
              메뉴 추가
            </Button>
            <Button 
              size="sm"
              variant="outline" 
              className="border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs h-8 px-3 rounded-xl transition-all shrink-0" 
              onClick={() => setRemoveMenuModalOpen(true)}
            >
              메뉴 제거
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
                      <td className="px-4 py-3.5 text-start text-xs font-bold text-slate-700 dark:text-slate-200">
                        {menu.name}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-750">
                          {menuCategories.find((category) => category.id === menu.menuCategoryId)?.name ?? "기타"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-end">
                        <span className={`text-xs font-black ${
                          isOutOfStock 
                            ? "text-rose-500 dark:text-rose-400" 
                            : isLowStock 
                              ? "text-amber-500 dark:text-amber-400 font-extrabold" 
                              : "text-slate-800 dark:text-slate-200"
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
      {menuDetail && (
        <InventoryDetailModal
          menu={menuDetail}
          openState={menuDetailModalOpenState}
          setOpenState={setMenuDetailModalOpenState}
        />
      )}
      <InventoryCreateModal
        openState={createMenuModalOpen}
        setOpenState={setCreateMenuModalOpen}
      />
      <InventoryRemoveModal
        openState={removeMenuModalOpen}
        setOpenState={setRemoveMenuModalOpen}
      />
    </div>
  );

}
