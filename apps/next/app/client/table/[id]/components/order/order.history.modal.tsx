
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import OrderDetailModal from "./order.detail.modal";
import * as ClientTableResponse from "shared/types/responses/client/table"

export default function OrderHistoryModal({
  openState, setOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
}) {
  const [orderDetailModalOpenState, setOrderDetailModalOpenState] = useState(false);
  const [orderDetail, setOrderDetail] = useState<ClientTableResponse.Get["result"]["tableContexts"][number]["orders"][number] | null>(null);

  const { menus } = useMenuStore();
  const { clientTable } = useTableStore();

  const orders = clientTable?.tableContexts[0]?.orders ?? [];
  const orderHistories = orders.map((order) => {
    const menuOrders = order.menuOrders.map((menuOrder) => {
      const menu = menus.find((menu) => menu.id === menuOrder.menuId);
      if (!menu) return null;
      return {
        menuId: menuOrder.menuId,
        menuName: menu.name,
        menuPrice: menu.price,
        quantity: menuOrder.quantity,
        totalPrice: menu.price * menuOrder.quantity,
      }
    }).filter((menuOrder) => menuOrder !== null);

    return {
      orderId: order.id,
      orderDate: order.createdAt,
      menuOrders,
      totalPrice: menuOrders.reduce((acc, menuOrder) => acc + menuOrder.totalPrice, 0),
      payment: order.payment,
      order: order,
    }
  })

  const handleConfirm = () => {
    setOpenState(false);
  }
  const handleClose = () => {
    setOpenState(false);
  }

  return (
    <>
      <Dialog open={openState} onOpenChange={setOpenState}>
        <DialogContent className="fc w-[96%] min-h-[25rem] max-h-[40rem] justify-between border-blue-500 border-2 rounded-xl">
          {orderHistories.length === 0 ? (
            <DialogHeader >
              <DialogTitle>주문 내역이 없습니다</DialogTitle>
              <DialogDescription />
            </DialogHeader>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">주문 내역</DialogTitle>
                <DialogDescription className="text-md text-center">주문을 조회하려면 주문 목록을 클릭하세요.</DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader className="bg-gray-200">
                  <TableRow>
                    {/* <TableHead></TableHead> */}
                    <TableHead className="!text-left font-bold">주문 일시</TableHead>
                    <TableHead className="!text-center">상태</TableHead>
                    <TableHead className="!text-right">금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderHistories.map((orderHistory) => (
                    <TableRow
                      key={orderHistory.orderId}
                      onClick={() => {
                        setOrderDetail(orderHistory.order);
                        setOrderDetailModalOpenState(true)
                      }}
                      className="h-14 *:text-base *:tracking-tighter"
                    >
                      {/* <TableCell className="text-center">{index + 1}</TableCell> */}
                      <TableCell className="text-left">{new Date(orderHistory.orderDate).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}</TableCell>
                      <TableCell className="text-center">{
                        orderHistory.order.deletedAt !== null ? "주문취소" :
                      (orderHistory.payment.paid ? "결제완료" : "결제대기")}</TableCell>
                      <TableCell className="text-right">{orderHistory.totalPrice.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right">
                <span className="text-right text-lg mr-2">총액</span>
                <span className="text-right text-2xl font-bold">
                  {orderHistories.filter((orderHistory) => orderHistory.order.deletedAt === null).reduce((acc, orderHistory) => acc + orderHistory.totalPrice, 0).toLocaleString()} 원
                </span>
              </div>
              <DialogFooter className="h-fit fr *:flex-1 *:mx-2 *:h-14 *:rounded-2xl *:text-lg">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleClose}>닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <OrderDetailModal
        openState={orderDetailModalOpenState}
        setOpenState={setOrderDetailModalOpenState}
        orderDetail={orderDetail}
      />
    </>
  )
}