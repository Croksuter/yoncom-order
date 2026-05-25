"use client";

import { useState, type UIEventHandler } from "react";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import OrderDetailModal from "./order.detail.modal";
import { getOrderStatusLabel } from "~/lib/order-status";
import { History, ArrowRight } from "lucide-react";
import * as ClientTableResponse from "shared/types/responses/client/table";

export default function OrderHistoryPanel({
  onContentScroll,
}: {
  onContentScroll?: UIEventHandler<HTMLDivElement>;
}) {
  const [orderDetailModalOpenState, setOrderDetailModalOpenState] = useState(false);
  const [orderDetail, setOrderDetail] = useState<ClientTableResponse.Get["result"]["tableContexts"][number]["orders"][number] | null>(null);

  const { menus } = useMenuStore();
  const { clientTable } = useTableStore();

  const orders = clientTable?.tableContexts[0]?.orders ?? [];
  const orderHistories = orders.map((order) => {
    const menuOrders = order.menuOrders.map((menuOrder) => {
      const menu = menus.find((m) => m.id === menuOrder.menuId);
      if (!menu) return null;
      return {
        menuId: menuOrder.menuId,
        menuName: menu.name,
        menuPrice: menu.price,
        quantity: menuOrder.quantity,
        totalPrice: menu.price * menuOrder.quantity,
      };
    }).filter((menuOrder) => menuOrder !== null);

    return {
      orderId: order.id,
      orderDate: order.createdAt,
      menuOrders,
      totalPrice: menuOrders.reduce((acc, menuOrder) => acc + menuOrder.totalPrice, 0),
      payment: order.payment,
      order: order,
    };
  });

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar pb-24 pt-4 px-1" onScroll={onContentScroll}>
      <div style={{ minHeight: "max(0px, calc(100dvh - var(--client-header-height) - var(--client-footer-height)))" }}>
        {orderHistories.length === 0 ? (
          <div className="fc items-center justify-center py-20 text-center space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full text-slate-400 dark:text-slate-500">
              <History className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                주문 내역이 없습니다
              </h3>
              <p className="text-xs text-slate-400">
                아직 주문하신 내역이 존재하지 않습니다.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="space-y-1 text-center mb-6">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5 font-sans">
                <History className="h-5 w-5 text-primary" />
                이전 주문 내역
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                주문을 터치하시면 상세 내역을 확인할 수 있습니다.
              </p>
            </div>

            {/* List of Previous Orders */}
            <div className="space-y-3 mb-6">
              {orderHistories.map((orderHistory) => {
                const statusLabel = getOrderStatusLabel(orderHistory.order);
                const isCancelled = orderHistory.order.deletedAt !== null;
                const isPaid = orderHistory.order.payment?.status === "PAID";

                return (
                  <div
                    key={orderHistory.orderId}
                    onClick={() => {
                      setOrderDetail(orderHistory.order);
                      setOrderDetailModalOpenState(true);
                    }}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-[0_2px_8px_rgba(19,27,46,0.02)] hover:shadow-[0_4px_16px_rgba(19,27,46,0.04)] cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <div className="fc gap-1 min-w-0">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                        {new Date(orderHistory.orderDate).toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate">
                        {orderHistory.menuOrders[0]?.menuName}
                        {orderHistory.menuOrders.length > 1 && ` 외 ${orderHistory.menuOrders.length - 1}개`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="fc items-end">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${
                          isCancelled
                            ? "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-rose-400"
                            : isPaid
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                        }`}>
                          {statusLabel}
                        </span>
                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 mt-1">
                          ₩ {orderHistory.totalPrice.toLocaleString()}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cumulative Summary Row */}
            <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">누적 총 주문금액</span>
              <span className="text-lg font-black text-primary dark:text-brand-400">
                ₩ {orderHistories.filter((oh) => oh.order.deletedAt === null).reduce((acc, oh) => acc + oh.totalPrice, 0).toLocaleString()}
              </span>
            </div>
          </>
        )}
      </div>

      <OrderDetailModal
        openState={orderDetailModalOpenState}
        setOpenState={setOrderDetailModalOpenState}
        orderDetail={orderDetail}
      />
    </div>
  );
}
