
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import useCartStore from "~/stores/cart.store";
import * as ClientMenuResponse from "shared/types/responses/client/menu";
import { MinusIcon, PlusIcon } from "lucide-react";
import useTableStore from "~/stores/table.store";
import { toast } from "~/hooks/use-toast";
import { useValidateOrder } from "~/hooks/validate-order";
import { API_BASE_URL } from "shared/constants";
import { isUnresolvedPaymentOrder } from "~/lib/order-status";

export default function CartAddModal({
  menu,
  openState, setOpenState,
}: {
  menu: ClientMenuResponse.Get["result"][number]["menus"][number];
  openState: boolean;
  setOpenState: any;
}) {
  const [quantity, setQuantity] = useState<number>(1);
  const [invalid, setInvalid] = useState(false);

  const { addMenuOrder, menuOrders } = useCartStore();
  const { clientTable } = useTableStore();
  const validateOrder = useValidateOrder();

  const recentOrderedQuantity = menuOrders.find((m) => m.menuId === menu.id)?.quantity ?? 0;
  const maxQuantity = menu.quantity - recentOrderedQuantity;

  const handleConfirm = async () => {
    if (quantity <= 0 || quantity > maxQuantity) {
      setInvalid(true);
      return;
    }

    const inProgressOrder = clientTable?.tableContexts.some((tableContext) => tableContext.orders.some((order) => (
      isUnresolvedPaymentOrder(order)
    )));
    if (inProgressOrder) {
      toast({
        title: "입금 확인 전 주문이 있습니다.",
        description: "입금 안내를 확인하고 결제 완료 후 추가 주문해주세요.",
        variant: "destructive",
      });
      handleClose();
      return;
    }

    const isValid = await validateOrder([{ menuId: menu.id, quantity: quantity + recentOrderedQuantity }]);
    if (!isValid) return;

    addMenuOrder({ menuId: menu.id, quantity });
    handleClose();
  }

  const handleClose = () => {
    setTimeout(() => setQuantity(1), 100);
    setInvalid(false);
    setOpenState(false);
  }

  return (
    <Dialog open={openState} onOpenChange={handleClose}>
      <DialogContent className="fixed bottom-0 top-auto left-0 translate-x-0 translate-y-0 w-full max-w-full rounded-t-[2rem] rounded-b-none border-t border-x border-b-0 border-brand-100 bg-background/95 backdrop-blur-lg p-6 pb-8 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:bottom-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-md sm:rounded-2xl sm:border sm:shadow-lg sm:p-6 smooth-transition">
        <DialogHeader className="fc justify-between items-center space-y-3">
          {menu.image.length !== 0 ? (
            <img src={menu.image} alt="" width={140} height={140} className="rounded-2xl m-2 w-[140px] h-[140px] object-cover shadow-sm" />
          ) : (
            <img src={"/favicon.ico"} alt="" width={120} height={120} className="rounded-2xl m-2 opacity-30" />
          )}
          <div className="text-center space-y-1">
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">{menu.name}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground max-w-[280px] mx-auto !-mt-0 leading-relaxed">{menu.description}</DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="fc items-center justify-center space-y-4 my-4">
          <div className="fr justify-center items-center bg-secondary/80 p-1.5 rounded-2xl w-fit">
            <Button 
              onClick={() => quantity > 1 && setQuantity(quantity - 1)}
              className="w-11 h-11 bg-background hover:bg-slate-100 text-foreground shadow-sm rounded-xl hover-lift active:scale-95 transition-all"
              variant="ghost"
            ><MinusIcon className="h-5 w-5"/></Button>
            <Input
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="text-center w-16 !text-2xl font-bold h-11 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 input-no-spinner"
            />
            <Button 
              onClick={() => quantity < maxQuantity && setQuantity(quantity + 1)}
              className="w-11 h-11 bg-background hover:bg-slate-100 text-foreground shadow-sm rounded-xl hover-lift active:scale-95 transition-all"
              variant="ghost"
            ><PlusIcon className="h-5 w-5"/></Button>
          </div>
          
          <div className="fc items-center text-xs text-muted-foreground space-y-1">
            <span>추가 주문 가능 수량: <span className="font-semibold text-foreground">{maxQuantity}개</span></span>
            {recentOrderedQuantity > 0 && (
              <span className="font-semibold text-destructive animate-pulse">이미 카트에 {recentOrderedQuantity}개 담겨있습니다.</span>
            )}
          </div>
        </div>

        <DialogDescription className={`text-center text-xs ${invalid ? "dangerTXT" : "hidden"}`}>⚠︎ 올바른 수량을 입력하세요.</DialogDescription>
        
        <DialogFooter className="fr gap-3 *:flex-1 *:h-12 *:rounded-xl *:text-base mt-2">
          <Button variant="outline" onClick={handleClose} className="border-slate-200 hover:bg-slate-50 transition-colors">취소</Button>
          <Button className="bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/10 hover-lift active:scale-98 transition-all" onClick={handleConfirm}>
            <div className="fc items-center justify-center leading-none">
              <span className="text-lg font-bold">{(quantity * menu.price).toLocaleString()}원</span>
              <span className="text-[10px] opacity-80 mt-0.5">장바구니 담기</span>
            </div>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}
