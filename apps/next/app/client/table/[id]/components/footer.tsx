import { useState } from "react";
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
  canViewOrders = true,
}: {
  activeTab: "menu" | "orders";
  setActiveTab: (tab: "menu" | "orders") => void;
  canViewOrders?: boolean;
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
          className="fixed right-6 bottom-20 z-40 w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_8px_24px_rgba(0,61,155,0.3)] transition-transform duration-300 active:scale-95 hover:bg-brand-600 cursor-pointer"
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
      <nav className="fixed bottom-0 left-[50%] translate-x-[-50%] w-full max-w-[600px] z-50 bg-background/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-border shadow-[0_-8px_30px_rgba(0,61,155,0.05)] flex justify-around items-center px-6 py-2.5 pb-5">
        {/* Menu (Tab Selector) */}
        <button
          onClick={() => setActiveTab("menu")}
          className={`px-4 py-2 rounded-full flex flex-row items-center justify-center gap-2 transition-all duration-200 active:scale-95 cursor-pointer ${
            activeTab === "menu"
              ? "bg-brand-100 dark:bg-brand-900/30 text-primary"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
          }`}
        >
          <Utensils className="h-4 w-4 stroke-[2.5]" />
          <span className={`text-xs ${activeTab === "menu" ? "font-extrabold" : "font-semibold"}`}>메뉴</span>
        </button>

        {/* Dynamic Center Action Button (Pulsing Deposit Status) */}
        {inProgressOrderRemain && (
          <button
            onClick={handleOpenUnresolvedOrder}
            disabled={isRefreshingTable}
            className="flex flex-row items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-[0_4px_12px_rgba(245,158,11,0.25)] animate-pulse disabled:opacity-50 cursor-pointer transition-all duration-200 active:scale-95 font-sans"
          >
            {needsManualReview ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            <span className="text-xs font-extrabold">
              {needsManualReview ? "입금 확인 중" : "입금 대기"}
            </span>
          </button>
        )}

        {canViewOrders && (
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-full flex flex-row items-center justify-center gap-2 transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === "orders"
                ? "bg-brand-100 dark:bg-brand-900/30 text-primary"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
          }`}
        >
          <Receipt className="h-4 w-4 stroke-[2.5]" />
          <span className={`text-xs ${activeTab === "orders" ? "font-extrabold" : "font-semibold"}`}>주문내역</span>
        </button>
        )}
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
