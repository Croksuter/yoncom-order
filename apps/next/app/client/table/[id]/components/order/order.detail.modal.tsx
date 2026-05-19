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
  const { menus } = useMenuStore();

  if (!orderDetail) return null;

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
  const originalAmount = orderDetail.payment.originalAmount ?? orderDetail.payment.amount;
  const expectedTransferAmount = orderDetail.payment.expectedTransferAmount ?? orderDetail.payment.amount;
  const menuOrderStatusLabel = (status: string) => {
    if (status === "PENDING") return "조리 중";
    if (status === "READY") return "준비 완료";
    if (status === "PICKED_UP") return "수령 완료";
    if (status === "CANCELLED") return "취소";
    return status;
  };

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
              <DialogDescription className="text-center">
                주문금액 {originalAmount.toLocaleString()}원 · 결제코드 {orderDetail.payment.paymentCode ?? "-"} · 입금액 {expectedTransferAmount.toLocaleString()}원
              </DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader className="bg-gray-200">
                <TableRow>
                  <TableHead className="!text-left font-bold">메뉴</TableHead>
                  <TableHead className="!text-right">단가</TableHead>
                  <TableHead className="!text-right">수량</TableHead>
                  <TableHead className="!text-right">가격</TableHead>
                  <TableHead className="!text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuOrderInfos.map((menuOrderInfo) => {
                  const menuOrder = orderDetail.menuOrders.find((item) => item.menuId === menuOrderInfo!.menuId);

                  return (
                    <TableRow key={menuOrderInfo!.menuId} className="h-14 *:text-base"
                    >
                      <TableCell className="text-left font-bold">{menuOrderInfo!.menuName}</TableCell>
                      <TableCell className="text-right">{menuOrderInfo!.menuPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{menuOrderInfo!.quantity}</TableCell>
                      <TableCell className="text-right">{menuOrderInfo!.totalPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{menuOrder ? menuOrderStatusLabel(menuOrder.status) : "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="text-right">
              <span className="text-right text-lg mr-2">총액</span>
              <span className="text-right text-2xl font-bold">
                {expectedTransferAmount.toLocaleString()} 원
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
