import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import useTableStore from "~/stores/table.store";
import useMenuStore from "~/stores/menu.store";
import MenuInstance from "./menu.instance";
import MenuCompleteModal from "./menu.complete.modal";
import { useState } from "react";
import { menuOrderStatus } from "db/schema";

export default function MenuMonitor({
  menuId,
}: {
  menuId: string;
}) {
  const [menuCompleteModalOpen, setMenuCompleteModalOpen] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [menuOrderId, setMenuOrderId] = useState("");
  const [tableName, setTableName] = useState("");

  const { menus } = useMenuStore();
  const { tables } = useTableStore();

  const menu = menus.find((menu) => menu.id === menuId)!;

  const menuOrders = tables
    .flatMap((table) => ({
      orders: table.tableContexts[0]?.orders || [],
      tableName: table.name,
    }))
    .flatMap(({ orders, tableName }) => orders
        .filter((order) => order?.payment?.paid && order?.deletedAt === null)
        .flatMap(
          (order) => order.menuOrders
            .filter(menuOrder => menuOrder.menuId === menuId)
            .filter(menuOrder => menuOrder.status === menuOrderStatus.PENDING)
            .map(menuOrder => ({ ...menuOrder, timestamp: order.createdAt })),
        ).map((menuOrder) => ({
          id: menuOrder.id,
          menuId: menu.id,
          menuName: menu.name,
          menuPrice: menu.price,
          quantity: menuOrder.quantity,
          status: menuOrder.status,
          tableName,
          timestamp: menuOrder.timestamp,
        })),
    );

  return (
    <div className="full p-2">
      <Card className="full bg-[#F2F2F2] px-3 fc rounded-3xl">
        <CardHeader className="px-2">
          <CardTitle className="text-xl font-bold">{menu.name}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto *:hover:cursor-pointer">
          {menuOrders
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((menuOrder) => 
            <MenuInstance 
              key={menuOrder.timestamp} 
              order={menuOrder} 
              onClick={() => {
                setMenuName(menuOrder.menuName);
                setMenuOrderId(menuOrder.id);
                setTableName(menuOrder.tableName);
                setMenuCompleteModalOpen(true);
              }}
            />
          )}
        </CardContent>
      </Card>
      <MenuCompleteModal
        openState={menuCompleteModalOpen}
        setOpenState={setMenuCompleteModalOpen}
        menuName={menuName}
        tableName={tableName}
        menuOrderId={menuOrderId}
      />
    </div>
  );
}