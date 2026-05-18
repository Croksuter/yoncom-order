import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button"
import CartModal from "./cart/cart.modal";
import useCartStore from "~/stores/cart.store";
import useTableStore from "~/stores/table.store";
import OrderModal from "./order/order.modal";
import OrderHistoryModal from "./order/order.history.modal";

export default function Footer() {
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderHistoryModalOpen, setOrderHistoryModalOpen] = useState(false);
  const { menuOrders } = useCartStore();
  const { clientTable, clientGetTable } = useTableStore();

  const quantity = menuOrders.reduce((acc, menuOrder) => acc + menuOrder.quantity, 0);

  const inProgressOrderRemain = clientTable?.tableContexts.some((tableContext) => tableContext.orders.some((order) => !order.payment.paid && order.deletedAt === null));
  useEffect(() => {
    if (inProgressOrderRemain) {
      const interval = setInterval(() => {
        if (inProgressOrderRemain) {
          clientGetTable({
            tableId: clientTable!.id,
          });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [clientTable]);

  return (
    <>
      <div className="w-full h-20 fr p-1 mb-3">
        <div className="w-fit h-full mr-2">
          <Button 
            variant="outline" 
            className="w-full h-full text-center text-lg bg-gray-100 hover:bg-gray-200 rounded-3xl"
            onClick={async () => {
              await useTableStore.getState().clientGetTable({
                tableId: clientTable!.id,
              });
              setOrderHistoryModalOpen(true);
            }}
          >
            <span className="leading-6 text-gray-500">이전<br />주문내역</span>
          </Button>
        </div>
        {inProgressOrderRemain
          ? (
            <Button
              onClick={async () => {
                await useTableStore.getState().clientGetTable({
                  tableId: clientTable!.id,
                });
                const newClientTable = useTableStore.getState().clientTable;
                if (newClientTable?.tableContexts.some((tableContext) => tableContext.orders.some((order) => !order.payment.paid))) {
                  setPurchaseModalOpen(true);
                }
              }}
              className="fc flex-1 h-full rounded-3xl bg-gray-500 text-white text-2xl hover:cursor-pointer hover:bg-gray-600"
            >결제하기<br /><span className="-mt-2 text-sm text-gray-300">결제 대기중인 항목이 있습니다.</span>
            </Button>
          ) : (
            <Button
              onClick={() => setOrderModalOpen(true)}
              className="flex-1 h-full rounded-3xl bg-blue-500 text-white text-2xl hover:bg-blue-600"
            >장바구니
              {quantity > 0 && (
                <span className="block -mr-4 w-7 h-7 text-lg text-center text-blue-600 bg-white rounded-full leading-6">{quantity}</span>
              )}
            </Button>
          )
        }
        <OrderModal
          openState={purchaseModalOpen}
          setOpenState={setPurchaseModalOpen}
        />
        <CartModal
          openState={orderModalOpen}
          setOpenState={setOrderModalOpen}
          setPurchaseModalOpenState={setPurchaseModalOpen}
        />
        <OrderHistoryModal
          openState={orderHistoryModalOpen}
          setOpenState={setOrderHistoryModalOpen}
        />
      </div>
    </>
  )
}