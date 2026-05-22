
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
import { Loader2 } from "lucide-react";

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
    if (!isValid) {
      setDuringPurchase(false);
      return;
    }
    
    const res = await purchaseMenuOrders();
    if (res === null) {
      setDuringPurchase(false);
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
        <DialogContent className="fixed bottom-0 top-auto left-0 translate-x-0 translate-y-0 w-full max-w-full rounded-t-[2rem] rounded-b-none border-t border-x border-b-0 border-brand-100 bg-background/95 backdrop-blur-lg p-6 pb-8 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:bottom-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-md sm:rounded-2xl sm:border sm:shadow-lg sm:p-6 smooth-transition fc justify-between min-h-[25rem] max-h-[85vh]">
          {noMenuOrder || invalidMenuOrder ? (
            <DialogHeader className="py-8 text-center space-y-2">
              <DialogTitle className="text-xl font-bold text-muted-foreground">{
                noMenuOrder ? "장바구니에 담은 메뉴가 없습니다" : "주문 정보가 잘못되었습니다"
              }</DialogTitle>
              <DialogDescription className="text-xs">원하는 메뉴를 먼저 장바구니에 담아주세요.</DialogDescription>
            </DialogHeader>
          ) : (
            <>
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-2xl font-bold tracking-tight text-foreground text-center">장바구니</DialogTitle>
                <DialogDescription className="text-xs text-center text-muted-foreground">주문을 수정하려면 해당 품목을 클릭하세요.</DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto my-4 max-h-[40vh] border rounded-xl border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                      <TableHead className="!text-left font-semibold text-slate-500 h-10">메뉴</TableHead>
                      <TableHead className="!text-right font-semibold text-slate-500 h-10">단가</TableHead>
                      <TableHead className="!text-right font-semibold text-slate-500 h-10">수량</TableHead>
                      <TableHead className="!text-right font-semibold text-slate-500 h-10">가격</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {menuOrderInfos.map((menuOrderInfo, index) => (
                      <TableRow
                        key={menuOrderInfo!.menuId}
                        onClick={() => {
                          setModalMenuOrder(menuOrders[index]);
                          setModalOpenState(true)
                        }}
                        className="h-12 hover:bg-slate-50/50 active:bg-slate-100/50 cursor-pointer border-b border-slate-50 transition-colors"
                      >
                        <TableCell className="text-left font-bold text-foreground text-sm py-2">{menuOrderInfo!.menuName}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground py-2">{menuOrderInfo!.menuPrice.toLocaleString()}원</TableCell>
                        <TableCell className="text-right text-sm py-2 font-medium">{menuOrderInfo!.quantity}개</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-foreground py-2">{menuOrderInfo!.totalPrice.toLocaleString()}원</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="fr justify-between items-center py-2 px-1 mb-4">
                <span className="text-base text-muted-foreground font-medium">최종 결제 금액</span>
                <span className="text-2xl font-bold text-brand-600">
                  {menuOrderInfos.reduce((acc, menuOrderInfo) => acc + menuOrderInfo!.totalPrice, 0).toLocaleString()}원
                </span>
              </div>

              <DialogFooter className="fr gap-3 *:flex-1 *:h-12 *:rounded-xl *:text-base">
                <Button variant="outline" onClick={handleClose} disabled={duringPurchase} className="border-slate-200 hover:bg-slate-50">취소</Button>
                {duringPurchase ? (
                  <Button disabled className="bg-brand-400 text-white cursor-not-allowed">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    주문 처리 중...
                  </Button>
                ) : (
                  <Button className="bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/10 hover-lift active:scale-98 transition-all" onClick={handleConfirm}>
                    주문 완료하기
                  </Button>
                )}
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
