"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import useMenuStore from "~/stores/menu.store";
import MenuAddModal from "./components/menu.add.modal";
import MenuMonitor from "./components/menu.monitor";
import MenuRemoveModal from "./components/menu.remove.modal";

export default function AdminCookerPage() {
  const { menus } = useMenuStore();

  const [menuAddModalOpen, setMenuAddModalOpen] = useState(false);
  const [menuRemoveModalOpen, setMenuRemoveModalOpen] = useState(false);
  const [monitoringMenus, setMonitoringMenus] = useState<string[]>([]);

  return (
    <main className="h-screen w-screen bg-white p-2 fc">
      <div className="items-center fr">
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
      <div className="h-fit w-full justify-end *:mx-1 fr">
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
      <div className="w-full flex-1 p-2 fr">
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
