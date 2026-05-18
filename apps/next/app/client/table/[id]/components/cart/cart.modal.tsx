
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import useCartStore, { CartState } from "~/stores/cart.store";
import useMenuStore from "~/stores/menu.store";
import OrderUpdateModal from "../order/order.update.modal";
import OrderModal from "../order/order.modal";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";
import { useValidateOrder } from "~/hooks/validate-order";

export default function CartModal({
  openState, setOpenState,
  setPurchaseModalOpenState,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  setPurchaseModalOpenState: (open: boolean) => void;
}) {
  const [confirmModalOpenState, setConfirmModalOpenState] = useState(false);
  const [modalOpenState, setModalOpenState] = useState(false);
  const [modalMenuOrder, setModalMenuOrder] = useState<CartState["menuOrders"][number] | null>(null);
  const [duringPurchase, setDuringPurchase] = useState(false);

  const { clientMenuCategories } = useMenuStore();
  const { menuOrders, purchaseMenuOrders } = useCartStore();
  const { clientTable } = useTableStore();
  const validateOrder = useValidateOrder();

  const menus = clientMenuCategories?.flatMap((menuCategory) => menuCategory.menus) ?? [];
  const menuOrderInfos = menuOrders.map((menuOrder) => {
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

  const noMenuOrder = menuOrderInfos.length === 0;
  const invalidMenuOrder = menuOrderInfos.length === 0
    || menuOrderInfos.some((menuOrderInfo) => menuOrderInfo === null)

  const handleConfirm = async () => {
    if (duringPurchase) return;
    setDuringPurchase(true);
    const isValid = await validateOrder(menuOrders);
    if (!isValid) return;
    
    const res = await purchaseMenuOrders();
    if (res === null) {
      return;
    }

    useCartStore.getState().clearMenuOrders();

    await useTableStore.getState().clientGetTable({
      tableId: clientTable!.id,
    });
    setConfirmModalOpenState(true);
    setOpenState(false);
    setDuringPurchase(false);
  }
  const handleClose = () => {
    setOpenState(false);
  }

  return (
    <>
      <Dialog open={openState} onOpenChange={setOpenState}>
        <DialogContent className="fc w-[96%] min-h-[25rem] max-h-[40rem] justify-between border-blue-500 border-2 rounded-xl">
          {noMenuOrder || invalidMenuOrder ? (
            <DialogHeader >
              <DialogTitle>{
                noMenuOrder ? "장바구니에 담은 메뉴가 없습니다" : "주문 정보가 잘못되었습니다"
              }</DialogTitle>
              <DialogDescription />
            </DialogHeader>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">장바구니</DialogTitle>
                <DialogDescription className="text-md text-center">주문을 수정하려면 주문 목록을 클릭하세요.</DialogDescription>
              </DialogHeader>
              <Table>
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
                  {menuOrderInfos.map((menuOrderInfo, index) => (
                    <TableRow
                      key={menuOrderInfo!.menuId}
                      onClick={() => {
                        console.log(menuOrders[index]);
                        setModalMenuOrder(menuOrders[index]);
                        setModalOpenState(true)
                      }}
                      className="h-14 *:text-base *:tracking-tighter"
                    >
                      {/* <TableCell className="text-center">{index + 1}</TableCell> */}
                      {/* 자간 좁히기 */}
                      <TableCell className="text-left font-bold">{menuOrderInfo!.menuName}</TableCell>
                      <TableCell className="text-right">{menuOrderInfo!.menuPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{menuOrderInfo!.quantity}</TableCell>
                      <TableCell className="text-right">{menuOrderInfo!.totalPrice.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right">
                <span className="text-right text-lg mr-2">총액</span>
                <span className="text-right text-2xl font-bold">
                  {menuOrderInfos.reduce((acc, menuOrderInfo) => acc + menuOrderInfo!.totalPrice, 0).toLocaleString()} 원
                </span>
              </div>
              <DialogFooter className="h-fit fr *:flex-1 *:mx-2 *:h-14 *:rounded-2xl *:text-lg">
                <Button variant="outline" onClick={handleClose}>취소</Button>
                <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleConfirm}>주문하기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {modalMenuOrder && (
        <OrderUpdateModal
          menuOrder={modalMenuOrder}
          openState={modalOpenState}
          setOpenState={setModalOpenState}
        />
      )}
      <OrderModal
        openState={confirmModalOpenState}
        setOpenState={setConfirmModalOpenState}
      />
    </>
  )
}