"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import MenuAddModal from "./components/menu.add.modal";
import MenuMonitor from "./components/menu.monitor";
import MenuRemoveModal from "./components/menu.remove.modal";

export default function AdminCookerPage() {
  const { menus } = useMenuStore();
  const { tables } = useTableStore();

  const [menuAddModalOpen, setMenuAddModalOpen] = useState(false);
  const [menuRemoveModalOpen, setMenuRemoveModalOpen] = useState(false);
  const [monitoringMenus, setMonitoringMenus] = useState<string[]>([]);
  const pendingMenuIds = useMemo(() => {
    const menuIds = new Set<string>();

    for (const table of tables) {
      for (const order of table.tableContexts[0]?.orders ?? []) {
        if (!order?.payment?.paid || order.deletedAt !== null) {
          continue;
        }

        for (const menuOrder of order.menuOrders) {
          if (menuOrder.deletedAt === null && menuOrder.status === "PENDING") {
            menuIds.add(menuOrder.menuId);
          }
        }
      }
    }

    return [...menuIds].filter((menuId) => menus.some((menu) => menu.id === menuId));
  }, [menus, tables]);

  useEffect(() => {
    if (monitoringMenus.length === 0 && pendingMenuIds.length > 0) {
      setMonitoringMenus(pendingMenuIds);
    }
  }, [monitoringMenus.length, pendingMenuIds]);

  return (
    <main className="flex min-h-screen w-screen flex-col bg-white p-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mx-4 my-4 text-2xl font-bold">메뉴 모니터링</h1>
        <Button
          variant="outline"
          className="bg-slate-600 text-white"
          onClick={() => {
            window.open("/admin/pos", "_blank");
          }}
        >
          포스로 이동
        </Button>
      </div>
      <div className="flex h-fit w-full flex-wrap justify-end gap-2">
        <Button disabled={menus.length === 0} onClick={() => setMenuAddModalOpen(true)}>
          메뉴 추가
        </Button>
        <Button
          disabled={monitoringMenus.length === 0}
          variant="outline"
          onClick={() => setMenuRemoveModalOpen(true)}
        >
          메뉴 제거
        </Button>
      </div>
      <div className="flex w-full flex-1 flex-col gap-3 overflow-y-auto p-2 sm:flex-row">
        {monitoringMenus.map((menuId) => (
          <MenuMonitor key={menuId} menuId={menuId} />
        ))}
      </div>
      <MenuAddModal
        openState={menuAddModalOpen}
        setOpenState={setMenuAddModalOpen}
        monitoringMenus={monitoringMenus}
        setMonitoringMenus={setMonitoringMenus}
      />
      <MenuRemoveModal
        openState={menuRemoveModalOpen}
        setOpenState={setMenuRemoveModalOpen}
        monitoringMenus={monitoringMenus}
        setMonitoringMenus={setMonitoringMenus}
      />
    </main>
  );
}
