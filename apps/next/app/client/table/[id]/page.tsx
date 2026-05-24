"use client";

import { use, useEffect, useState } from "react";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import Footer from "./components/footer";
import Header from "./components/header";
import Menus from "./components/menu/menus";
import ShopIntro from "./components/shop.intro";
import OrderHistoryPanel from "./components/order/order.history.panel";
import OrderModal from "./components/order/order.modal";
import OrderPaymentPanel from "./components/order/order.payment.panel";
import { Skeleton } from "~/components/ui/skeleton";
import { isPaymentInstructionOrder } from "~/lib/order-status";

type ClientTablePageProps = {
  params: Promise<{ id: string }>;
};

export default function ClientTablePage({ params }: ClientTablePageProps) {
  const { id } = use(params);
  const { clientTable } = useTableStore();
  const { clientMenuCategories } = useMenuStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu");
  const isValidTableId = id.length === 15;
  const activeUnpaidOrder = clientTable?.tableContexts[0]?.orders.find(isPaymentInstructionOrder);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (activeUnpaidOrder) {
      const verified = localStorage.getItem(`verified_order_${activeUnpaidOrder.id}`) === "true";
      setIsVerified(verified);
    } else {
      setIsVerified(false);
    }
  }, [activeUnpaidOrder]);

  useEffect(() => {
    const fetchTableData = async () => {
      setLoading(true);
      useTableStore.setState({ clientTable: null });

      if (!isValidTableId) {
        setLoading(false);
        return;
      }

      try {
        await useTableStore.getState().clientGetTable({ tableId: id });
      } catch (error) {
        console.error("Failed to load table:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchTableData();
  }, [id, isValidTableId]);

  useEffect(() => {
    if (!clientTable) {
      return;
    }

    void useMenuStore.getState().clientLoad({});
  }, [clientTable]);

  useEffect(() => {
    if (typeof window === "undefined" || !clientMenuCategories) return;
    clientMenuCategories
      .flatMap((cat) => cat.menus)
      .forEach((menu) => {
        if (menu.image) {
          const img = new window.Image();
          img.src = menu.image;
        }
      });
  }, [clientMenuCategories]);

  if (loading) {
    return (
      <main className="h-screen w-screen items-center justify-center overflow-hidden fc p-4">
        <div className="w-full max-w-[600px] flex-1 overflow-hidden px-2 fc gap-4">
          {/* Header Skeleton */}
          <div className="fr justify-between items-center py-4 border-b border-gray-100">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
          {/* ShopIntro Skeleton */}
          <div className="space-y-2 py-4">
            <Skeleton className="h-6 w-32 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          {/* Tabs/Categories Skeleton */}
          <div className="fr gap-2 pb-2">
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-full" />
          </div>
          {/* Menu Items Skeleton */}
          <div className="flex-1 space-y-4 overflow-hidden pt-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="fr gap-4 p-3 border border-gray-100 rounded-xl items-center bg-card">
                <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3 rounded" />
                  <Skeleton className="h-4 w-2/3 rounded" />
                  <Skeleton className="h-5 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
          {/* Footer Skeleton */}
          <div className="fr justify-between items-center py-4 border-t border-gray-100 gap-2">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen items-center justify-center overflow-hidden fc">
      {clientTable && clientMenuCategories ? (
        activeUnpaidOrder && isVerified ? (
          <OrderPaymentPanel order={activeUnpaidOrder} />
        ) : (
          <>
            <Header />
            <div className="w-full max-w-[600px] flex-1 overflow-hidden px-4 fc relative pt-16">
              {activeTab === "menu" ? (
                <div className="flex-1 fc overflow-hidden w-full">
                  <ShopIntro tableName={clientTable.name} tableSeats={clientTable.seats} />
                  <Menus menuCategories={clientMenuCategories} />
                </div>
              ) : (
                <OrderHistoryPanel />
              )}
              <Footer activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* Locked Verification Modal */}
            {activeUnpaidOrder && !isVerified && (
              <OrderModal
                openState={true}
                setOpenState={() => {}}
                onVerify={() => setIsVerified(true)}
              />
            )}
          </>
        )
      ) : (
        <div className="p-6 text-center">
          <h1 className="text-xl font-bold">
            {isValidTableId ? "존재하지 않는 테이블입니다." : "올바르지 않은 테이블 주소입니다."}
          </h1>
          <p className="mt-2 text-sm text-slate-500">tableId: {id}</p>
        </div>
      )}
    </main>
  );
}

