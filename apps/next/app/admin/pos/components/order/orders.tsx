import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import useTableStore from "~/stores/table.store";
import * as Schema from "db/schema";
import OrderInstance from "./order.instance";
import OrderDetailModal from "./order.detail.modal";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import { Button } from "~/components/ui/button";

export default function Orders() {
  const [orderDetail, setOrderDetail] = useState<AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number] | null>(null);
  const [orderDetailModalOpenState, setOrderDetailModalOpenState] = useState(false);

  const { tables } = useTableStore();
  const orders = tables
    .filter((table) => table.tableContexts[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts[0].orders);
  const inProgressOrders = orders.filter((order) => (
    order.deletedAt === null
    && order.menuOrders.some((menuOrder) => menuOrder.status === Schema.menuOrderStatus.PENDING))
  ).sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="full p-2">
      <Card className="full bg-[#F2F2F2] px-3 fc rounded-3xl">
        <CardHeader className="px-2 fr items-center justify-between">
          <CardTitle className="text-2xl">주문 현황 <b className="font-light text-lg">({inProgressOrders.length})</b></CardTitle>
          <Button variant="outline" className="bg-slate-600 text-white" onClick={() => {
            window.open("/admin/cooker", "_blank");
          }}>요리 섹션</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto *:hover:cursor-pointer [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {inProgressOrders.map((order) => 
            <OrderInstance 
              key={order.id} 
              order={order} 
              onClick={() => {
                setOrderDetail(order);
                setOrderDetailModalOpenState(true);
              }}
            />
          )}
        </CardContent>
      </Card>
      {orderDetail && (
        <OrderDetailModal
          order={orderDetail}
          openState={orderDetailModalOpenState}
          setOpenState={setOrderDetailModalOpenState}
        />
      )}
    </div>
  );
}