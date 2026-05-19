
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
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
  
  const originalAmount = order.payment.originalAmount ?? menuOrderInfos.reduce((acc, menuOrderInfo) => acc + menuOrderInfo!.totalPrice, 0);
  const expectedTransferAmount = order.payment.expectedTransferAmount ?? order.payment.amount;
  const paymentStatus = order.payment.paid ? "결제 완료" :
    order.payment.status === "MANUAL_REVIEW" ? "입금 확인 필요" :
    order.payment.status === "EXPIRED" ? "입금 기한 만료" :
    order.payment.status === "CANCELLED" ? "취소" :
    "입금 대기";

  const menuOrderStatusLabel = (status: string) => {
    if (status === "PENDING") return "조리 중";
    if (status === "READY") return "준비 완료";
    if (status === "PICKED_UP") return "수령 완료";
    if (status === "CANCELLED") return "취소";
    return status;
  };

  const handelOrderCancel = async () => {
    await useTableStore.getState().adminCancelOrder({
      orderId: order.id,
    });
    handleClose();
  }

  const handlePay = async () => {
    await useTableStore.getState().adminPayOrder({
      orderId: order.id,
    });
    handleClose();
  }

  const handlePickUp = async (menuOrderId: string) => {
    await useTableStore.getState().adminPickUpOrder({
      menuOrderId,
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
              <span><span className="font-bold">표시번호</span>: {order.displayNumber ?? "-"}</span>
              <span><span className="font-bold">일시</span>: {new Date(order.createdAt).toLocaleString()}</span>
              <span><span className="font-bold">결제 상태</span>: {paymentStatus}</span>
              <span><span className="font-bold">주문금액</span>: {originalAmount.toLocaleString()}원</span>
              <span><span className="font-bold">결제코드</span>: {order.payment.paymentCode ?? "-"} / <span className="font-bold">입금금액</span>: {expectedTransferAmount.toLocaleString()}원</span>
              {order.payment.paid && <span className="text-xs text-neutral-500">결제 완료 주문을 취소하면 환불은 별도 확인이 필요합니다.</span>}
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
                <TableHead className="!text-center">상태</TableHead>
                <TableHead className="!text-center">처리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menuOrderInfos.map((menuOrderInfo) => {
                const menuOrder = order.menuOrders.find((item) => item.menuId === menuOrderInfo!.menuId);

                return (
                  <TableRow
                    key={menuOrderInfo!.menuId}
                    className="h-14 *:text-base"
                  >
                    {/* <TableCell className="text-center">{index + 1}</TableCell> */}
                    <TableCell className="text-left font-bold">{menuOrderInfo!.menuName}</TableCell>
                    <TableCell className="text-right">{menuOrderInfo!.menuPrice.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{menuOrderInfo!.quantity}</TableCell>
                    <TableCell className="text-right">{menuOrderInfo!.totalPrice.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{menuOrder ? menuOrderStatusLabel(menuOrder.status) : "-"}</TableCell>
                    <TableCell className="text-center">
                      {menuOrder?.status === "READY" ? (
                        <Button size="sm" onClick={() => handlePickUp(menuOrder.id)}>수령 완료</Button>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="text-left mr-4 w-full h-fit fr justify-end items-end">
            <span className="text-left text-lg mr-2">주문금액</span>
            <span className="text-left text-2xl font-bold">
              {menuOrderInfos.reduce((acc, menuOrderInfo) => acc + menuOrderInfo!.totalPrice, 0).toLocaleString()} 원
            </span>
          </div>
          <DialogFooter className="w-full h-fit fr justify-end items-end">
            <div className="w-fit *:mx-1">
              <Button className="dangerBG dangerB" onClick={handelOrderCancel}>주문 취소</Button>
              {!order.payment.paid && (
                <Button className="dangerBG dangerB" onClick={handlePay}>관리자 결제 완료 처리</Button>
              )}
              <Button onClick={handleClose}>닫기</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
