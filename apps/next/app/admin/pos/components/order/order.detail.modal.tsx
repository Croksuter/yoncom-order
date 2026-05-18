
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import useMenuStore from "~/stores/menu.store";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import useTableStore from "~/stores/table.store";

export default function OrderDetailModal({
  openState, setOpenState,
  order,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  order: AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number];
}) {
  const { menus } = useMenuStore();

  const menuOrderInfos = order.menuOrders.map((menuOrder) => {
    const menu = menus.find((menu) => menu.id === menuOrder.menuId);

    if (!menu) return null;
    return {
      menuId: menuOrder.menuId,
      menuName: menu.name,
      menuPrice: menu.price,
      quantity: menuOrder.quantity,
      totalPrice: menu.price * menuOrder.quantity,
    }
  }).filter((menuOrderInfo) => menuOrderInfo !== null);
  
  const handelOrderCancel = async () => {
    await useTableStore.getState().adminCancelOrder({
      orderId: order.id,
    });
    handleClose();
  }

  const handlePay = async () => {
    await useTableStore.getState().adminDeposit({
      name: "임의 결제",
      timestamp: new Date().getTime(),
      amount: order.payment.amount,
      bank: "임의 결제",
    });
    handleClose();
  }

  const handleClose = () => {
    setOpenState(false);
  }

  return (
    <>
      <Dialog open={openState} onOpenChange={setOpenState}>
        <DialogContent className="fc min-w-fit min-h-[25rem] max-h-[40rem] justify-between rounded-xl">
          <DialogHeader className="fc items-start w-fit">
            <DialogTitle className="text-2xl">주문 정보</DialogTitle>
            <DialogDescription className="fc">
              <span><span className="font-bold">id</span>: {order.id}</span>
              <span><span className="font-bold">일시</span>: {new Date(order.createdAt).toLocaleString()}</span>
              <span><span className="font-bold">결제 상태</span>: {order.payment.paid ? "결제 완료 → 조리 중" : "결제 대기"}</span>
            </DialogDescription>
          </DialogHeader>
          <Table className="w-full">
            <TableHeader className="bg-gray-200">
              <TableRow>
                {/* <TableHead></TableHead> */}
                <TableHead className="!text-left font-bold">메뉴</TableHead>
                <TableHead className="!text-right">단가</TableHead>
                <TableHead className="!text-right">수량</TableHead>
                <TableHead className="!text-right">가격</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menuOrderInfos.map((menuOrderInfo) => (
                <TableRow
                  key={menuOrderInfo.menuId}
                  className="h-14 *:text-base"
                >
                  {/* <TableCell className="text-center">{index + 1}</TableCell> */}
                  <TableCell className="text-left font-bold">{menuOrderInfo!.menuName}</TableCell>
                  <TableCell className="text-right">{menuOrderInfo!.menuPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{menuOrderInfo!.quantity}</TableCell>
                  <TableCell className="text-right">{menuOrderInfo!.totalPrice.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-left mr-4 w-full h-fit fr justify-end items-end">
            <span className="text-left text-lg mr-2">총액</span>
            <span className="text-left text-2xl font-bold">
              {menuOrderInfos.reduce((acc, menuOrderInfo) => acc + menuOrderInfo!.totalPrice, 0).toLocaleString()} 원
            </span>
          </div>
          <DialogFooter className="w-full h-fit fr justify-end items-end">
            <div className="w-fit *:mx-1">
              <Button className="dangerBG dangerB" onClick={handelOrderCancel}>주문 취소</Button>
              {!order.payment.paid && (
                <Button className="dangerBG dangerB" onClick={handlePay}>결제</Button>
              )}
              <Button onClick={handleClose}>닫기</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}