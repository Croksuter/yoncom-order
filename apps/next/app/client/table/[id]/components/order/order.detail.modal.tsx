import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import useMenuStore from "~/stores/menu.store";
import * as ClientTableResponse from "shared/types/responses/client/table";

export default function OrderDetailModal({
  openState, setOpenState,
  orderDetail,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  orderDetail: ClientTableResponse.Get["result"]["tableContexts"][number]["orders"][number] | null;
}) {
  if (!orderDetail) return null;

  const { menus } = useMenuStore();
  const menuOrderInfos = orderDetail.menuOrders.map((menuOrder) => {
    const menu = menus.find((menu) => menu.id === menuOrder.menuId);
    if (!menu) return null;
    return {
      menuId: menuOrder.menuId,
      menuName: menu.name,
      menuPrice: menu.price,
      quantity: menuOrder.quantity,
      totalPrice: menu.price * menuOrder.quantity,
    }
  })

  const handleClose = () => {
    setOpenState(false);
  }

  return (
    <>
      <Dialog open={openState} onOpenChange={setOpenState}>
        <DialogContent className="fc w-[96%] min-h-[25rem] max-h-[40rem] justify-between border-blue-500 border-2 rounded-xl">
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">주문 내역</DialogTitle>
              <DialogDescription className="text-md text-center">{new Date(orderDetail.createdAt).toLocaleString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}</DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader className="bg-gray-200">
                <TableRow>
                  <TableHead className="!text-left font-bold">메뉴</TableHead>
                  <TableHead className="!text-right">단가</TableHead>
                  <TableHead className="!text-right">수량</TableHead>
                  <TableHead className="!text-right">가격</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuOrderInfos.map((menuOrderInfo) => (
                  <TableRow key={menuOrderInfo!.menuId} className="h-14 *:text-base"
                  >
                    <TableCell className="text-left font-bold">{menuOrderInfo!.menuName}</TableCell>
                    <TableCell className="text-right">{menuOrderInfo!.menuPrice.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{menuOrderInfo!.quantity}</TableCell>
                    <TableCell className="text-right">{menuOrderInfo!.totalPrice.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-right">
              <span className="text-right text-lg mr-2">총액</span>
              <span className="text-right text-2xl font-bold">
                {orderDetail.payment.amount.toLocaleString()} 원
              </span>
            </div>
            <DialogFooter className="h-fit fr *:flex-1 *:mx-2 *:h-14 *:rounded-2xl *:text-lg">
              <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleClose}>닫기</Button>
            </DialogFooter>
          </>
        </DialogContent>
      </Dialog>
    </>
  )
}