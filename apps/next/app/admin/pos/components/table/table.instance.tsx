import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import TableSetModal from "./table.set.modal";
import * as Schema from "db/schema";
import { dateDiffString } from "~/lib/date";
import useMenuStore from "~/stores/menu.store";
import { TimerIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "~/components/ui/table";
import TableDetailModal from "./table.detail.modal";

export default function TableInstance({
  table
}: {
  table: AdminTableResponse.Get["result"][0]
}) {
  const activeTableContext = table.tableContexts.find((tableContext) => tableContext.deletedAt === null);
  const inUse = activeTableContext !== undefined;
  const [modalOpen, setModalOpen] = useState(false);
  const [now, setNow] = useState(0);

  const { menus } = useMenuStore();

  const menuId2menu = (menuId: string) => menus.find((menu) => menu.id === menuId);
  const menuOrders = activeTableContext?.orders
    .filter((order) => 
      order.deletedAt === null
      && order.payment.paid
    ).map((order) => order.menuOrders).flat() || [];
  const amount = menuOrders.reduce((acc, menuOrder) => acc + (menuId2menu(menuOrder.menuId)?.price ?? Infinity * menuOrder.quantity), 0) || 0;

  const isOnOrder = activeTableContext?.orders.some((order) => 
    order.deletedAt === null
    && order.payment.paid
    && order.menuOrders.some((menuOrder) => menuOrder.status === Schema.menuOrderStatus.PENDING)
  ) || false;

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
      <Card className={
        `rounded-2xl aspect-square active:brightness-95 hover:cursor-pointer 
        ${inUse
          ? "bg-[#D9D9D9]"
          : "bg-white drop-shadow-lg"
        }`
      } style={{
        boxShadow: inUse ? "inset 2px 2px 8px rgba(0,0,0,0.2)" : "none",
      }} onClick={() => setModalOpen(true)}>

        { /* CardHeader: 테이블이 미사용 중일때 표시 */}
        <CardHeader className={`${inUse ? `hidden` : `justify-center items-center full p-0`}`}>
          <CardTitle className="font-extrabold text-xl">{table.name}</CardTitle>
          <CardDescription className="text-sm text-neutral-500 !m-0">
            {table.seats}인석
          </CardDescription>
        </CardHeader>

        { /* CardContent: 테이블이 사용 중일때 표시 */
          inUse && (
            <CardContent className={`${!inUse ? `hidden` : `full p-0 fc`}`}>
              <div className="w-full h-fit fc justify-between px-3 my-2 *:-mt-1">
                <span className="fr justify-between block text-lg font-bold">
                  <span>{table.name}</span>
                  {isOnOrder && <TimerIcon className="mt-1"/>}
                </span>
                <span className="block font-normal text-neutral-500">{
                  dateDiffString(now, activeTableContext.createdAt).startsWith("-")
                    ? "00:00"
                    : dateDiffString(now, activeTableContext.createdAt)
                }
                </span>
              </div>
              <div className="w-full flex-1 overflow-y-auto fc bg-[#F2F2F2]">
                <Table>
                  <TableBody>
                    {menuOrders.map((menuOrder) => (
                      <TableRow key={menuOrder.id} className="*:py-1">
                        <TableCell>{menuOrder.status === Schema.menuOrderStatus.PENDING ? "⌛" : "✅"} {menuId2menu(menuOrder.menuId)?.name}</TableCell>
                        <TableCell className="font-bold">{menuOrder.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="w-full h-fit fr font-bold justify-between px-3 my-2">
                <span>{table.seats}인석</span>
                <span>{amount.toLocaleString()} 원</span>
              </div>
            </CardContent>
          )}
      </Card>
      <TableDetailModal
        table={table}
        openState={modalOpen}
        setOpenState={setModalOpen}
      />
    </>
  )
}