import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import CartModal from "./cart/cart.modal";
import useCartStore from "~/stores/cart.store";
import useTableStore from "~/stores/table.store";
import OrderModal from "./order/order.modal";
import OrderHistoryModal from "./order/order.history.modal";
import { isPaymentInstructionOrder, isUnresolvedPaymentOrder } from "~/lib/order-status";
import { runWithBlockingLoading } from "~/lib/blocking-loading";
import { Utensils, ShoppingCart, Receipt, Clock, AlertCircle } from "lucide-react";

export default function Footer({
  activeTab,
  setActiveTab,
}: {
  activeTab: "menu" | "orders";
  setActiveTab: (tab: "menu" | "orders") => void;
}) {
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderHistoryModalOpen, setOrderHistoryModalOpen] = useState(false);
  const [isRefreshingTable, setIsRefreshingTable] = useState(false);
  const { menuOrders } = useCartStore();
  const { clientTable, clientGetTable } = useTableStore();

  const quantity = menuOrders.reduce((acc, menuOrder) => acc + menuOrder.quantity, 0);
  const findUnresolvedPaymentOrder = (table: typeof clientTable) => (
    table?.tableContexts.flatMap((tableContext) => tableContext.orders).find(isUnresolvedPaymentOrder)
  );
  const unresolvedPaymentOrder = findUnresolvedPaymentOrder(clientTable);
  const inProgressOrderRemain = !!unresolvedPaymentOrder;
  const needsManualReview = unresolvedPaymentOrder?.payment.status === "MANUAL_REVIEW";

  useEffect(() => {
    if (inProgressOrderRemain) {
      const interval = setInterval(() => {
        if (inProgressOrderRemain) {
          void clientGetTable({
            tableId: clientTable!.id,
          });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [clientTable, inProgressOrderRemain, clientGetTable]);

  const refreshClientTable = async () => {
    if (!clientTable?.id) return null;

    const response = await clientGetTable({ tableId: clientTable.id });
    return response?.result ?? null;
  };

  const handleOpenUnresolvedOrder = async () => {
    if (isRefreshingTable) return;

    setIsRefreshingTable(true);
    try {
      await runWithBlockingLoading(async () => {
        const latestClientTable = await refreshClientTable();
        if (!latestClientTable) return;

        const latestUnresolvedPaymentOrder = findUnresolvedPaymentOrder(latestClientTable);
        if (latestUnresolvedPaymentOrder && isPaymentInstructionOrder(latestUnresolvedPaymentOrder)) {
          setPurchaseModalOpen(true);
        } else {
          setActiveTab("orders");
        }
      });
    } finally {
      setIsRefreshingTable(false);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) for Cart - Stitch Design */}
      {activeTab === "menu" && !inProgressOrderRemain && (
        <button
          onClick={() => setOrderModalOpen(true)}
          className="fixed right-6 bottom-24 z-40 w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_8px_24px_rgba(0,61,155,0.3)] transition-transform duration-300 active:scale-95 hover:bg-brand-600 cursor-pointer"
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5 stroke-[2.5px]" />
            {quantity > 0 && (
              <span className="absolute -top-3.5 -right-3.5 bg-destructive text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border-2 border-white animate-bounce">
                {quantity}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-[50%] translate-x-[-50%] w-full max-w-[600px] z-50 bg-background/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-border shadow-[0_-8px_30px_rgba(0,61,155,0.08)] flex justify-around items-center px-4 pb-6 pt-3">
        {/* Menu (Tab Selector) */}
        <button
          onClick={() => setActiveTab("menu")}
          className={`flex flex-col items-center justify-center font-bold text-xs gap-1 transition-all duration-200 active:scale-95 w-16 cursor-pointer ${
            activeTab === "menu"
              ? "text-primary font-extrabold"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <div className={`p-2 rounded-xl transition-all duration-250 ${
            activeTab === "menu"
              ? "bg-brand-100 dark:bg-brand-900/30 text-primary"
              : "hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}>
            <Utensils className="h-5 w-5" />
          </div>
          <span className="font-semibold">메뉴</span>
        </button>

        {/* Dynamic Center Action Button (Pulsing Deposit Status only displayed if unresolved order is present) */}
        {inProgressOrderRemain && (
          <button
            onClick={handleOpenUnresolvedOrder}
            disabled={isRefreshingTable}
            className="flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95 relative bottom-2 scale-105 z-10 w-24 text-center disabled:opacity-50 cursor-pointer"
          >
            <div className="bg-amber-500 hover:bg-amber-600 text-white p-3 rounded-2xl shadow-[0_8px_20px_rgba(245,158,11,0.3)] animate-pulse flex items-center justify-center">
              {needsManualReview ? <AlertCircle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
            </div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-500 mt-1 truncate max-w-full font-sans">
              {needsManualReview ? "입금 확인 중" : "입금 대기"}
            </span>
          </button>
        )}

        {/* Orders (Tab Selector) */}
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex flex-col items-center justify-center font-bold text-xs gap-1 transition-all duration-200 active:scale-95 w-16 cursor-pointer ${
            activeTab === "orders"
              ? "text-primary font-extrabold"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <div className={`p-2 rounded-xl transition-all duration-250 ${
            activeTab === "orders"
              ? "bg-brand-100 dark:bg-brand-900/30 text-primary"
              : "hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}>
            <Receipt className="h-5 w-5" />
          </div>
          <span className="font-semibold">주문내역</span>
        </button>
      </nav>

      <OrderModal
        openState={purchaseModalOpen}
        setOpenState={setPurchaseModalOpen}
      />
      <CartModal
        openState={orderModalOpen}
        setOpenState={setOrderModalOpen}
      />
      <OrderHistoryModal
        openState={orderHistoryModalOpen}
        setOpenState={setOrderHistoryModalOpen}
      />
    </>
  );
}


