import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import useMenuStore from "~/stores/menu.store";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import useTableStore from "~/stores/table.store";
import { getMenuOrderStatusLabel, getPaymentStatusLabel, isUnresolvedPaymentOrder } from "~/lib/order-status";

export default function OrderDetailModal({
  openState, setOpenState,
  order,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  order: AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number];
}) {
  const { menus } = useMenuStore();
  const [cancelReason, setCancelReason] = useState("");

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
  const paymentStatus = getPaymentStatusLabel(order.payment, order);
  const isPaidActive = order.payment.status === "PAID";
  const isRefundPending = order.payment.status === "REFUND_PENDING";
  const isRefunded = order.payment.status === "REFUNDED";
  const hasPickedUp = isPaidActive && order.menuOrders.some((menuOrder) => menuOrder.status === "PICKED_UP");

  const handelOrderCancel = async () => {
    if (isPaidActive && cancelReason.trim().length === 0) {
      return;
    }

    await useTableStore.getState().adminCancelOrder({
      orderId: order.id,
      cancelReason: isPaidActive ? cancelReason.trim() : undefined,
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
              {isPaidActive && <span className="text-xs text-neutral-500">결제 완료 주문을 취소하면 환불 대기 상태로 남습니다.</span>}
              {isRefundPending && <span className="text-xs text-amber-600">환불 완료 처리 전에는 테이블을 비울 수 없습니다.</span>}
              {hasPickedUp && <span className="text-xs text-neutral-500">수령 완료된 주문은 시스템에서 취소할 수 없습니다.</span>}
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
                    <TableCell className="text-center">{menuOrder ? getMenuOrderStatusLabel(menuOrder, order) : "-"}</TableCell>
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
          {isPaidActive && !hasPickedUp && (
            <div className="w-full space-y-1 text-sm">
              <label className="font-semibold" htmlFor="cancel-reason">취소 사유</label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="예: 고객 요청, 메뉴 품절, 중복 주문"
              />
            </div>
          )}
          <DialogFooter className="w-full h-fit fr justify-end items-end">
            <div className="w-fit *:mx-1">
              <Button
                className="dangerBG dangerB"
                disabled={hasPickedUp || isRefundPending || isRefunded || (isPaidActive && cancelReason.trim().length === 0)}
                onClick={handelOrderCancel}
              >
                {isRefundPending ? "환불 대기 중" : isRefunded ? "환불 완료" : isPaidActive ? "취소 및 환불 대기 처리" : "주문 취소"}
              </Button>
              {isUnresolvedPaymentOrder(order) && (
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
