import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import useTableStore from "~/stores/table.store";
import OrderInstance from "./order.instance";
import OrderDetailModal from "./order.detail.modal";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import { Button } from "~/components/ui/button";
import { isActiveOrder, isKitchenOrder, isUnresolvedPaymentOrder } from "~/lib/order-status";

export default function Orders() {
  const [orderDetail, setOrderDetail] = useState<AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number] | null>(null);
  const [orderDetailModalOpenState, setOrderDetailModalOpenState] = useState(false);

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

  // 매출 계산 (PAID 상태의 결제 금액 합산)
  const confirmedOrders = tables
    .filter((table) => table.tableContexts[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts[0].orders)
    .filter((order) => order.payment.status === "PAID");

  const totalRevenue = confirmedOrders.reduce((acc, order) => {
    return acc + (order.payment.expectedTransferAmount ?? order.payment.amount);
  }, 0);

  const candidateReasonLabel = (reason: string) => {
    if (reason === "EXPECTED_AMOUNT") return "입금금액 일치";
    if (reason === "ORIGINAL_AMOUNT") return "주문금액 입금";
    if (reason === "WITHIN_100") return "100원 미만 오차";
    return reason;
  };

  return (
    <div className="full p-2">
      <Card className="full bg-slate-100 dark:bg-slate-900/40 px-3 fc rounded-3xl border-slate-200/60 dark:border-slate-800/80 shadow-sm">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3">
          <CardTitle className="whitespace-nowrap text-xl sm:text-2xl font-bold text-foreground">
            주문 현황 <span className="font-medium text-muted-foreground text-lg">({inProgressOrders.length})</span>
          </CardTitle>
          <Button 
            variant="outline" 
            className="shrink-0 bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border-none shadow-sm shadow-slate-700/10 text-xs font-bold animate-fade-in" 
            onClick={() => {
              window.open("/admin/cooker", "_blank");
            }}
          >
            요리 섹션
          </Button>
        </CardHeader>

        {/* 주점 핵심 현황판 */}
        <div className="grid grid-cols-3 gap-2 px-2 mb-4">
          <div className="fc justify-center p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/30 transition-all hover:scale-[1.02]">
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400">누적 매출</span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-300 truncate">
              {totalRevenue.toLocaleString()}원
            </span>
          </div>
          <div className="fc justify-center p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100/60 dark:border-amber-900/30 transition-all hover:scale-[1.02]">
            <span className="text-[10px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400">입금 대기</span>
            <span className="text-sm sm:text-base font-extrabold text-amber-700 dark:text-amber-300">
              {reviewTransactions.length}건
            </span>
          </div>
          <div className="fc justify-center p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100/60 dark:border-rose-900/30 transition-all hover:scale-[1.02]">
            <span className="text-[10px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400">환불 대기</span>
            <span className="text-sm sm:text-base font-extrabold text-rose-700 dark:text-rose-300">
              {refundPendingOrders.length}건
            </span>
          </div>
        </div>

        <CardContent className="p-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-3 px-1 pb-4 flex-1">
          {reviewTransactions.length > 0 && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/10 p-3 space-y-3">
              <div className="flex items-center space-x-1.5 text-sm font-bold text-amber-950 dark:text-amber-400 px-1">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>입금 확인 필요 ({reviewTransactions.length})</span>
              </div>
              <div className="space-y-3">
                {reviewTransactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-2xl bg-white dark:bg-slate-900 p-3 shadow-sm border border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-50 dark:border-slate-800/50 pb-2">
                      <div className="fc">
                        <span className="text-sm font-bold text-foreground">
                          {transaction.depositor}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          실제 입금: {transaction.amount.toLocaleString()}원
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg px-2 h-7"
                        onClick={() => useTableStore.getState().adminIgnoreBankTransaction({ bankTransactionId: transaction.id })}
                      >
                        제외
                      </Button>
                    </div>
                    <div className="mt-2.5 space-y-2">
                      {transaction.candidates.length === 0 ? (
                        <span className="text-xs text-muted-foreground block text-center py-1">
                          🔍 매칭 후보 없음. 직접 확인 필요
                        </span>
                      ) : (
                        <div className="fc gap-1.5">
                          {transaction.candidates.map((candidate) => {
                            const isMatchDiff = candidate.diff === 0;
                            return (
                              <div 
                                key={candidate.paymentId}
                                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50"
                              >
                                <div className="fc text-left">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="text-xs font-bold text-foreground">
                                      {candidate.tableName}
                                    </span>
                                    <span className="text-[10px] font-semibold bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-md">
                                      #{candidate.displayNumber ?? "-"}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1 mt-0.5">
                                    <span className={`text-[10px] font-bold ${
                                      isMatchDiff 
                                        ? "text-emerald-600 dark:text-emerald-400" 
                                        : "text-amber-600 dark:text-amber-400"
                                    }`}>
                                      {candidateReasonLabel(candidate.reason)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">·</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      차액: {candidate.diff.toLocaleString()}원
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
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
                  </div>
                ))}
              </div>
            </div>
          )}
          {refundPendingOrders.length > 0 && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/10 p-3 space-y-3">
              <div className="flex items-center space-x-1.5 text-sm font-bold text-rose-950 dark:text-rose-400 px-1">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>환불 필요 ({refundPendingOrders.length})</span>
              </div>
              <div className="space-y-2">
                {refundPendingOrders.map(({ tableName, order }) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 p-3 shadow-sm border border-slate-100 dark:border-slate-800/80">
                    <div className="fc text-left min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-bold text-foreground truncate">{tableName}</span>
                        <span className="text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-md">
                          #{order.displayNumber ?? "-"}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1">
                        {(order.payment.refundAmount ?? order.payment.expectedTransferAmount ?? order.payment.amount).toLocaleString()}원
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {order.cancelReason ?? "취소 사유 없음"} · {order.cancelledAt ? new Date(order.cancelledAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-8 px-3 font-bold shrink-0 transition-all shadow-sm shadow-rose-600/10"
                      onClick={() => useTableStore.getState().adminRefundOrder({ orderId: order.id })}
                    >
                      완료
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
        </CardContent>
      </Card>
      {orderDetail && (
        <OrderDetailModal
          order={orderDetail}
          openState={orderDetailModalOpenState}
          setOpenState={setOrderDetailModalOpenState}
        />
      )}
    </div>
  );
}
