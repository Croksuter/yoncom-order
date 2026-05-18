
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

    const inProgressOrder = clientTable?.tableContexts.some((tableContext) => tableContext.orders.some((order) => !order.payment.paid && order.deletedAt === null));
    if (inProgressOrder) {
      toast({
        title: "결제되지 않은 주문이 있습니다.",
        description: "결제를 완료하고 주문해주세요.",
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
      <DialogContent className="w-[96%] border-blue-500 border-2 rounded-xl">
        <DialogHeader className="fc justify-between items-center">
          {menu.image.length !== 0 ? (
            <img src={menu.image} alt="" width={120} height={120} className="rounded-md m-2 w-[120px] h-[120px]" />
          ) : (
            <img src={"/favicon.ico"} alt="" width={120} height={120} className="rounded-md m-2" />
          )}
          <DialogTitle className="text-2xl font-bold">{menu.name}</DialogTitle>
          <DialogDescription className="text-md !-mt-0">{menu.description}</DialogDescription>
        </DialogHeader>
        <div className="fr justify-center items-center">
          <Button 
            onClick={() => quantity > 1 && setQuantity(quantity - 1)}
            className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white"
          ><MinusIcon className="scale-150"/></Button>
          <Input
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="text-center w-16 !text-2xl font-bold h-16 mx-4 input-no-spinner"
          />
          <Button 
            onClick={() => quantity < maxQuantity && setQuantity(quantity + 1)}
            className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white"
          ><PlusIcon className="scale-150"/></Button>
        </div>
        <span className="text-sm text-center">추가 주문 가능 수량: {maxQuantity}</span>
        {recentOrderedQuantity > 0 && <span className="text-sm text-center -mt-4 dangerTXT">이미 카트에 {recentOrderedQuantity}개 담았어요!</span>}
        <DialogDescription className={`-mt-2 text-right ${invalid ? "dangerTXT" : "hidden"}`}>⚠︎ 올바른 수량을 입력하세요.</DialogDescription>
        <DialogFooter className="fr *:flex-1 *:mx-2 *:h-14 *:rounded-2xl *:text-lg">
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button className="fc bg-blue-500 hover:bg-blue-600 text-white" onClick={handleConfirm}>
            <span className="text-2xl font-bold -mt-1">{quantity * menu.price}원</span>
            <span className="text-sm -mt-2">장바구니 담기</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}