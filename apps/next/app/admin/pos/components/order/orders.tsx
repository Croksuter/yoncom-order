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
  const candidateReasonLabel = (reason: string) => {
    if (reason === "EXPECTED_AMOUNT") return "입금금액 일치";
    if (reason === "ORIGINAL_AMOUNT") return "주문금액 입금";
    if (reason === "WITHIN_100") return "100원 미만 오차";
    return reason;
  };

  return (
    <div className="full p-2">
      <Card className="full bg-[#F2F2F2] px-3 fc rounded-3xl">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-2">
          <CardTitle className="whitespace-nowrap text-xl sm:text-2xl">주문 현황 <b className="font-light text-lg">({inProgressOrders.length})</b></CardTitle>
          <Button variant="outline" className="shrink-0 bg-slate-600 text-white" onClick={() => {
            window.open("/admin/cooker", "_blank");
          }}>요리 섹션</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {reviewTransactions.length > 0 && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2">
              <div className="mb-2 text-sm font-bold text-amber-900">입금 확인 필요 ({reviewTransactions.length})</div>
              <div className="space-y-2">
                {reviewTransactions.map((transaction) => (
                  <div key={transaction.id} className="rounded bg-white p-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">입금 {transaction.amount.toLocaleString()}원 · {transaction.depositor}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => useTableStore.getState().adminIgnoreBankTransaction({ bankTransactionId: transaction.id })}
                      >
                        처리 제외
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {transaction.candidates.length === 0 ? (
                        <span className="text-neutral-500">매칭 후보 없음: 입금자명과 은행 내역을 직접 확인하세요.</span>
                      ) : transaction.candidates.map((candidate) => (
                        <Button
                          key={candidate.paymentId}
                          size="sm"
                          className="bg-slate-700 text-white"
                          onClick={() => useTableStore.getState().adminConfirmBankTransaction({
                            bankTransactionId: transaction.id,
                            paymentId: candidate.paymentId,
                          })}
                        >
                          {candidate.tableName} #{candidate.displayNumber ?? "-"} 확정 · {candidateReasonLabel(candidate.reason)} · 차이 {candidate.diff.toLocaleString()}원
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {refundPendingOrders.length > 0 && (
            <div className="mb-3 rounded-md border border-rose-300 bg-rose-50 p-2">
              <div className="mb-2 text-sm font-bold text-rose-900">환불 필요 ({refundPendingOrders.length})</div>
              <div className="space-y-2">
                {refundPendingOrders.map(({ tableName, order }) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-2 text-sm">
                    <div>
                      <div className="font-semibold">{tableName} #{order.displayNumber ?? "-"} · {(order.payment.refundAmount ?? order.payment.expectedTransferAmount ?? order.payment.amount).toLocaleString()}원</div>
                      <div className="text-neutral-600">{order.cancelReason ?? "취소 사유 없음"} · {order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : "-"}</div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-rose-700 text-white"
                      onClick={() => useTableStore.getState().adminRefundOrder({ orderId: order.id })}
                    >
                      환불 완료 처리
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
