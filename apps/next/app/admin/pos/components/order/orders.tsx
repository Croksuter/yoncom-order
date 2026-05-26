import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import useTableStore from "~/stores/table.store";
import OrderInstance from "./order.instance";
import OrderDetailModal from "./order.detail.modal";
import PaymentSettingsModal from "./payment-settings.modal";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import { Button } from "~/components/ui/button";
import { isActiveOrder, isKitchenOrder, isUnresolvedPaymentOrder } from "~/lib/order-status";
import { Settings } from "lucide-react";

export default function Orders() {
  const [orderDetail, setOrderDetail] = useState<AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number] | null>(null);
  const [orderDetailModalOpenState, setOrderDetailModalOpenState] = useState(false);
  const [paymentSettingsOpenState, setPaymentSettingsOpenState] = useState(false);

  const { tables, bankTransactions } = useTableStore();
  const orderRows = tables
    .filter((table) => table.tableContexts[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts[0].orders.map((order) => ({
      tableName: table.name,
      order,
    })));
  const orders = orderRows.map((row) => row.order);
  const inProgressOrders = orders.filter((order) => {
    if (!isActiveOrder(order)) return false;
    if (isUnresolvedPaymentOrder(order)) return true;
    if (!isKitchenOrder(order)) return false;
    return order.menuOrders.some((menuOrder) => (
      menuOrder.status === "PENDING"
      || menuOrder.status === "READY"
    ));
  }).sort((a, b) => a.createdAt - b.createdAt);
  const refundPendingOrders = orderRows
    .filter(({ order }) => order.deletedAt === null && order.payment.status === "REFUND_PENDING")
    .sort((a, b) => a.order.createdAt - b.order.createdAt);
  const reviewTransactions = bankTransactions.filter((transaction) => transaction.status !== "IGNORED");



  const candidateReasonLabel = (reason: string) => {
    if (reason === "EXPECTED_AMOUNT") return "입금금액 일치";
    if (reason === "ORIGINAL_AMOUNT") return "주문금액 입금";
    if (reason === "WITHIN_100") return "100원 미만 오차";
    return reason;
  };

  // 파이프라인 상태별 오더 수 집계
  const activeOrdersForStats = orderRows
    .filter(({ order }) => order.deletedAt === null && order.status !== "CANCELLED" && order.status !== "EXPIRED")
    .map((row) => row.order);

  const pendingPaymentOrdersCount = activeOrdersForStats.filter(
    (order) => !isKitchenOrder(order) && order.payment.status !== "REFUND_PENDING"
  ).length;

  const cookingOrdersCount = activeOrdersForStats.filter(
    (order) => isKitchenOrder(order) && order.menuOrders.some((mo) => mo.status === "PENDING")
  ).length;

  const readyOrdersCount = activeOrdersForStats.filter(
    (order) => isKitchenOrder(order) && order.menuOrders.some((mo) => mo.status === "READY")
  ).length;

  const refundPendingOrdersCount = refundPendingOrders.length;

  return (
    <div className="full p-2 h-full">
      <div className="full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-md rounded-3xl flex flex-col overflow-hidden">
        {/* Header Block */}
        <div className="h-[76px] bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-800/60 flex justify-between items-center px-4 shrink-0">
          <div className="flex flex-col gap-1">
            <h3 className="font-extrabold text-base text-slate-800 dark:text-white leading-none">
              주문 대기열 <span className="text-slate-400 dark:text-slate-300 font-bold text-sm">({inProgressOrders.length + refundPendingOrdersCount})</span>
            </h3>
            {/* Status indicators */}
            <div className="flex gap-3 text-xs font-black text-slate-500 dark:text-slate-200 mt-1">
              <span className="flex items-center gap-1.5" title="입금대기">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>{pendingPaymentOrdersCount}</span>
              </span>
              <span className="flex items-center gap-1.5" title="조리 중">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
                <span>{cookingOrdersCount}</span>
              </span>
              <span className="flex items-center gap-1.5" title="조리완료">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>{readyOrdersCount}</span>
              </span>
              <span className="flex items-center gap-1.5" title="환불대기">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>{refundPendingOrdersCount}</span>
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-slate-200 px-2.5 text-xs font-extrabold text-slate-500 hover:text-slate-700 dark:border-slate-800 dark:text-slate-200"
            onClick={() => setPaymentSettingsOpenState(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            입금 설정
          </Button>
        </div>

        {/* Scrollable Orders Area */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-4 space-y-4">

          {/* 입금 확인 필요 Section */}
          {reviewTransactions.length > 0 && (
            <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/10 p-3.5 space-y-3.5 animate-fade-in">
              <div className="flex items-center space-x-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-wider px-1">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span>입금 확인 필요 ({reviewTransactions.length})</span>
              </div>
              <div className="space-y-3">
                {reviewTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-slate-50/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 border-l-4 border-l-amber-500 dark:border-l-amber-500 p-3.5 rounded-2xl shadow-sm hover:shadow-[0_8px_20px_rgba(245,158,11,0.08)] hover:border-amber-400/50 dark:hover:border-amber-500/30 transition-all duration-300 flex flex-col gap-3 group relative"
                  >
                    {/* Header Block */}
                    <div className="flex justify-between items-start">
                      <div className="fc">
                        <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                          {transaction.depositor}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-0.5">
                          은행 실시간 입금
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md border bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30">
                        입금 대기
                      </span>
                    </div>

                    {/* Body Block */}
                    <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-850 pt-2.5">
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-200">실제 입금액</span>
                        <span className="text-slate-800 dark:text-slate-100 font-extrabold">
                          {transaction.amount.toLocaleString()}원
                        </span>
                      </div>

                      {/* Candidates Sub-list */}
                      {transaction.candidates.length === 0 ? (
                        <div className="text-[10px] text-slate-400 dark:text-slate-300 block text-center py-1.5 font-medium bg-slate-50/50 dark:bg-slate-900/40 rounded-lg">
                          🔍 매칭 후보 없음 · 직접 확인 필요
                        </div>
                      ) : (
                        <div className="fc gap-1.5 pt-1">
                          {transaction.candidates.map((candidate) => {
                            const isMatchDiff = candidate.diff === 0;
                            return (
                              <div
                                key={candidate.paymentId}
                                className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800"
                              >
                                <div className="fc text-left min-w-0 flex-1 mr-2">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 truncate">
                                      {candidate.tableName}
                                    </span>
                                    <span className="text-[9px] font-extrabold bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 px-1 rounded">
                                      #{candidate.displayNumber ?? "-"}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1 mt-0.5 text-[9px]">
                                    <span className={`font-bold ${
                                      isMatchDiff
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-amber-600 dark:text-amber-400"
                                    }`}>
                                      {candidateReasonLabel(candidate.reason)}
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-700">·</span>
                                    <span className="text-slate-400 dark:text-slate-300 font-semibold truncate">
                                      차액: {candidate.diff.toLocaleString()}원
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className={`h-6 px-2.5 rounded-lg text-[10px] font-extrabold transition-all shadow-sm flex-shrink-0 ${
                                    isMatchDiff
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10"
                                      : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/10"
                                  }`}
                                  onClick={() => useTableStore.getState().adminConfirmBankTransaction({
                                    bankTransactionId: transaction.id,
                                    paymentId: candidate.paymentId,
                                  })}
                                >
                                  확정
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions Bottom Block */}
                    <div className="flex justify-end pt-1 border-t border-dashed border-slate-100 dark:border-slate-800">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-[10px] font-extrabold text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg px-2 h-7"
                        onClick={() => useTableStore.getState().adminIgnoreBankTransaction({ bankTransactionId: transaction.id })}
                      >
                        목록에서 제외
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active & Refund Pending Orders List */}
          <div className="space-y-3">
            {/* 1. Refund Pending Orders (Styled with red left edge!) */}
            {refundPendingOrders.map(({ tableName, order }) => (
              <div
                key={order.id}
                className="bg-slate-50/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 border-l-4 border-l-rose-500 dark:border-l-rose-500 p-3.5 rounded-2xl shadow-sm hover:shadow-[0_8px_20px_rgba(244,63,94,0.08)] hover:border-rose-400/50 dark:hover:border-rose-500/30 transition-all duration-300 flex flex-col gap-3 group relative cursor-pointer"
                onClick={() => {
                  setOrderDetail(order);
                  setOrderDetailModalOpenState(true);
                }}
              >
                {/* Header Block */}
                <div className="flex justify-between items-start">
                  <div className="fc">
                    <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors">
                      {tableName}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-300 font-bold mt-0.5">
                      #{order.displayNumber ?? "-"} · {order.cancelledAt ? new Date(order.cancelledAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md border bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30">
                    환불 대기
                  </span>
                </div>

                {/* Body Block */}
                <div className="space-y-1.5 border-t border-slate-150 dark:border-slate-850 pt-2.5 text-xs font-semibold text-slate-650 dark:text-slate-350">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-200">환불 예정 금액</span>
                    <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                      {(order.payment.refundAmount ?? order.payment.expectedTransferAmount ?? order.payment.amount).toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-slate-500 dark:text-slate-200">취소 사유</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold truncate max-w-[130px]">
                      {order.cancelReason ?? "사유 없음"}
                    </span>
                  </div>
                </div>


              </div>
            ))}

            {/* 2. In-Progress/Active Orders */}
            {inProgressOrders.map((order) =>
              <OrderInstance
                key={order.id}
                order={order}
                onClick={() => {
                  setOrderDetail(order);
                  setOrderDetailModalOpenState(true);
                }}
              />
            )}

            {/* Empty Queue State */}
            {inProgressOrders.length === 0 && refundPendingOrders.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <span className="text-4xl">🎉</span>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-300 mt-3">진행 중인 주문이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {orderDetail && (
        <OrderDetailModal
          order={orderDetail}
          openState={orderDetailModalOpenState}
          setOpenState={setOrderDetailModalOpenState}
        />
      )}
      <PaymentSettingsModal
        openState={paymentSettingsOpenState}
        setOpenState={setPaymentSettingsOpenState}
      />
    </div>
  );
}
