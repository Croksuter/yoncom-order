
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import { dateDiffString } from "~/lib/date";
import { useEffect, useState } from "react";
import * as Schema from "db/schema";

export default function OrderInstance({ 
  order,
  onClick,
}: { 
  order: AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number];
  onClick: () => void;
}) {
  const [now, setNow] = useState(0);

  const { tables } = useTableStore();
  const { menus } = useMenuStore();
  const table = tables.find((table) => table.tableContexts.some((tableContext) => tableContext.id === order.tableContextId));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Card className="rounded-xl my-3" onClick={onClick}>
        <CardHeader className="py-2 px-3 rounded-t-xl fr justify-between bg-slate-500">
          <CardTitle className="text-white">{table?.name}</CardTitle>
          <div className="!-m-1 !p-0 text-white">{
            dateDiffString(now, order.createdAt).startsWith("-") 
              ? "00:00" 
              : dateDiffString(now, order.createdAt)
          }</div>
        </CardHeader>
        <CardContent className="fr px-4 py-1 items-end">
          <ul className="flex-1">
            {order.menuOrders.map((menuOrder) => {
              const menu = menus.find((menu) => menu.id === menuOrder.menuId);
              const status = menuOrder.status === Schema.menuOrderStatus.PENDING ? "⌛"
                : menuOrder.status === Schema.menuOrderStatus.SERVED ? "✅"
                : "❌"; // 취소됨

              return (
                <li key={menuOrder.menuId} className="text-sm my-1">
                  {status} {menu?.name} x{menuOrder.quantity}
                </li>
              )
            })}
          </ul>
          <span className="w-fit font-bold my-1">{order.payment?.paid ? "조리 중" : "결제 대기"}</span>
        </CardContent>
      </Card>
    </>
  )
}