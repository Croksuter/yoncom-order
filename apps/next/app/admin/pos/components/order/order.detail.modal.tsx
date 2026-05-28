import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { DialogContent } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import useMenuStore from "~/stores/menu.store";
import * as AdminTableResponse from "shared/types/responses/admin/table";
import useTableStore from "~/stores/table.store";
import { getMenuOrderStatusLabel, getPaymentStatusLabel, isUnresolvedPaymentOrder } from "~/lib/order-status";
import { getMenuOrderProgress } from "~/lib/menu-order-progress";

export default function OrderDetailModal({
  openState, setOpenState,
  order,
}: {
  openState: boolean;
  setOpenState: (open: boolean) => void;
  order: AdminTableResponse.Get["result"][number]["tableContexts"][number]["orders"][number];
}) {
  const { menus } = useMenuStore();
  const [cancelReason, setCancelReason] = useState("");
  const [actionQuantities, setActionQuantities] = useState<Record<string, number>>({});

  const menuOrderInfos = order.menuOrders.map((menuOrder) => {
    const menu = menus.find((menu) => menu.id === menuOrder.menuId);

    if (!menu) return null;
    return {
      menuId: menuOrder.menuId,
      menuName: menu.name,
      menuPrice: menu.price,
      quantity: menuOrder.quantity,
      totalPrice: menu.price * menuOrder.quantity,
    }
  }).filter((menuOrderInfo) => menuOrderInfo !== null);

  const originalAmount = order.payment.originalAmount ?? menuOrderInfos.reduce((acc, menuOrderInfo) => acc + menuOrderInfo!.totalPrice, 0);
  const expectedTransferAmount = order.payment.expectedTransferAmount ?? order.payment.amount;
  const paymentStatus = getPaymentStatusLabel(order.payment, order);
  const isPaidActive = order.payment.status === "PAID";
  const isRefundPending = order.payment.status === "REFUND_PENDING";
  const isRefunded = order.payment.status === "REFUNDED";
  const hasPickedUp = isPaidActive && order.menuOrders.some((menuOrder) => menuOrder.status === "PICKED_UP");

  const handelOrderCancel = async () => {
    if (isPaidActive && cancelReason.trim().length === 0) {
      return;
    }

    await useTableStore.getState().adminCancelOrder({
      orderId: order.id,
      cancelReason: isPaidActive ? cancelReason.trim() : undefined,
    });
    handleClose();
  }

  const handleRefund = async () => {
    await useTableStore.getState().adminRefundOrder({
      orderId: order.id,
    });
    handleClose();
  }

  const handlePay = async () => {
    await useTableStore.getState().adminPayOrder({
      orderId: order.id,
    });
    handleClose();
  }

  const getActionQuantity = (key: string, maxQuantity: number) => {
    const value = actionQuantities[key] ?? maxQuantity;
    return Math.min(maxQuantity, Math.max(1, value));
  };

  const setActionQuantity = (key: string, nextQuantity: number, maxQuantity: number) => {
    setActionQuantities((state) => ({
      ...state,
      [key]: Math.min(maxQuantity, Math.max(1, nextQuantity)),
    }));
  };

  const renderQuantitySelect = (key: string, maxQuantity: number) => (
    <select
      value={getActionQuantity(key, maxQuantity)}
      onChange={(event) => setActionQuantity(key, Number(event.target.value), maxQuantity)}
      className="h-8 min-w-14 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-brand-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
    >
      {Array.from({ length: maxQuantity }, (_, index) => index + 1).map((quantity) => (
        <option key={quantity} value={quantity}>{quantity}개</option>
      ))}
    </select>
  );

  const handlePickUp = async (menuOrderId: string, quantity?: number) => {
    await useTableStore.getState().adminPickUpOrder({
      menuOrderId,
      quantity,
    });
    handleClose();
  }

  const handleComplete = async (menuOrderId: string, quantity?: number) => {
    await useTableStore.getState().adminCompleteOrder({
      menuOrderId,
      quantity,
    });
    handleClose();
  }

  const handleClose = () => {
    setOpenState(false);
  }

  return (
    <>
      <Dialog open={openState} onOpenChange={setOpenState}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
          <DialogHeader className="w-full">
            <DialogTitle className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center justify-between">
              <span>주문 상세 정보</span>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-300">#{order.id.slice(-6).toUpperCase()}</span>
            </DialogTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-850">
              <div className="fc gap-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150/40 dark:border-slate-800 shadow-sm">
                <span className="text-xs text-slate-450 dark:text-slate-300 font-semibold uppercase tracking-wider">표시 번호</span>
                <span className="text-sm font-bold text-slate-850 dark:text-slate-150">#{order.displayNumber ?? "-"}</span>
              </div>
              <div className="fc gap-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150/40 dark:border-slate-800 shadow-sm">
                <span className="text-xs text-slate-450 dark:text-slate-300 font-semibold uppercase tracking-wider">주문 일시</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                  {new Date(order.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="fc gap-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150/40 dark:border-slate-800 shadow-sm">
                <span className="text-xs text-slate-450 dark:text-slate-300 font-semibold uppercase tracking-wider">결제 상태</span>
                <span className={`text-sm font-bold ${
                  isRefundPending ? "text-rose-500" : isRefunded ? "text-slate-400" : isPaidActive ? "text-emerald-500" : "text-amber-500"
                }`}>
                  {paymentStatus}
                </span>
              </div>
              <div className="fc gap-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150/40 dark:border-slate-800 shadow-sm">
                <span className="text-xs text-slate-450 dark:text-slate-300 font-semibold uppercase tracking-wider">결제 코드</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{order.payment.paymentCode ?? "-"}</span>
              </div>
            </div>

            <div className="mt-3.5 space-y-1 px-1">
              {isPaidActive && <p className="text-xs text-slate-500 dark:text-slate-200 font-medium flex items-center gap-1">💡 결제 완료 주문을 취소하면 환불 대기 상태로 남습니다.</p>}
              {isRefundPending && <p className="text-xs text-rose-500 dark:text-rose-450 font-medium flex items-center gap-1">⚠️ 환불 완료 처리 전에는 테이블을 비울 수 없습니다.</p>}
              {hasPickedUp && <p className="text-xs text-slate-500 dark:text-slate-200 font-medium flex items-center gap-1">🚫 수령 완료된 주문은 시스템에서 취소할 수 없습니다.</p>}
            </div>
          </DialogHeader>

          {/* Menu Items Table */}
          <div className="overflow-hidden border border-slate-200/60 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 mt-4 shadow-sm">
            <Table className="w-full">
              <TableHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="!text-left font-bold text-xs text-slate-400 dark:text-slate-300 px-4 h-10">메뉴</TableHead>
                  <TableHead className="!text-right font-bold text-xs text-slate-400 dark:text-slate-300 px-4 h-10">단가</TableHead>
                  <TableHead className="!text-right font-bold text-xs text-slate-400 dark:text-slate-300 px-4 h-10">수량</TableHead>
                  <TableHead className="!text-right font-bold text-xs text-slate-400 dark:text-slate-300 px-4 h-10">가격</TableHead>
                  <TableHead className="!text-center font-bold text-xs text-slate-400 dark:text-slate-300 px-4 h-10">상태</TableHead>
                  <TableHead className="!text-center font-bold text-xs text-slate-400 dark:text-slate-300 px-4 h-10">처리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuOrderInfos.map((menuOrderInfo) => {
                  const menuOrder = order.menuOrders.find((item) => item.menuId === menuOrderInfo!.menuId);
                  const progress = getMenuOrderProgress(menuOrder);
                  const completeActionKey = menuOrder ? `complete:${menuOrder.id}` : "";
                  const pickUpActionKey = menuOrder ? `pickup:${menuOrder.id}` : "";
                  const completeQuantity = getActionQuantity(completeActionKey, progress.pendingQuantity);
                  const pickUpQuantity = getActionQuantity(pickUpActionKey, progress.readyQuantity);

                  return (
                    <TableRow
                      key={menuOrderInfo!.menuId}
                      className="h-12 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 border-b border-slate-100 dark:border-slate-850/50 last:border-b-0 *:text-sm"
                    >
                      <TableCell className="text-left font-bold text-slate-800 dark:text-slate-150 px-4 py-3 truncate max-w-[150px]">{menuOrderInfo!.menuName}</TableCell>
                      <TableCell className="text-right text-slate-500 dark:text-slate-200 px-4 py-3 font-normal">{menuOrderInfo!.menuPrice.toLocaleString()}원</TableCell>
                      <TableCell className="text-right text-slate-800 dark:text-slate-200 px-4 py-3">x{menuOrderInfo!.quantity}</TableCell>
                      <TableCell className="text-right font-bold text-slate-800 dark:text-slate-100 px-4 py-3">{menuOrderInfo!.totalPrice.toLocaleString()}원</TableCell>
                      <TableCell className="text-center px-4 py-3">
                        {menuOrder ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                              {getMenuOrderStatusLabel(menuOrder, order)}
                            </span>
                            <div className="flex flex-wrap justify-center gap-1">
                              {progress.pendingQuantity > 0 && (
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:bg-amber-950/20 dark:text-amber-300">
                                  대기 {progress.pendingQuantity}
                                </span>
                              )}
                              {progress.readyQuantity > 0 && (
                                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-300">
                                  조리 {progress.readyQuantity}
                                </span>
                              )}
                              {progress.pickedUpQuantity > 0 && (
                                <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-600 dark:bg-brand-950/20 dark:text-brand-300">
                                  수령 {progress.pickedUpQuantity}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-center px-4 py-3">
                        {menuOrder && (progress.pendingQuantity > 0 || progress.readyQuantity > 0) ? (
                          <div className="flex flex-col items-center gap-2">
                            {progress.pendingQuantity > 0 && (
                              <div className="flex items-center justify-center gap-1.5">
                                {renderQuantitySelect(completeActionKey, progress.pendingQuantity)}
                                <Button
                                  size="sm"
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-8 px-3.5 font-bold text-xs transition-all shadow-sm border-none shadow-emerald-500/10"
                                  onClick={() => handleComplete(menuOrder.id, completeQuantity)}
                                >
                                  조리 완료
                                </Button>
                              </div>
                            )}
                            {progress.readyQuantity > 0 && (
                              <div className="flex items-center justify-center gap-1.5">
                                {renderQuantitySelect(pickUpActionKey, progress.readyQuantity)}
                                <Button
                                  size="sm"
                                  className="bg-brand-500 hover:bg-brand-600 text-white rounded-xl h-8 px-3.5 font-bold text-xs transition-all shadow-sm border-none shadow-brand-500/10"
                                  onClick={() => handlePickUp(menuOrder.id, pickUpQuantity)}
                                >
                                  수령 완료
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Sum Summary block */}
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-150/40 dark:border-slate-800/80 mt-4">
            <span className="text-black dark:text-white font-bold text-sm">주문 합계 금액</span>
            <div className="fr items-end gap-1">
              <span className="text-2xl font-black text-slate-500 dark:text-brand-700">
                {expectedTransferAmount.toLocaleString()} /
              </span>
              <span className="text-2xl font-black text-brand-500 dark:text-brand-700">
                {menuOrderInfos.reduce((acc, menuOrderInfo) => acc + menuOrderInfo!.totalPrice, 0).toLocaleString()}
              </span>
              <span className="text-sm font-bold text-slate-450">원</span>
            </div>
          </div>

          {/* Cancel inputs if paid */}
          {isPaidActive && !hasPickedUp && (
            <div className="w-full space-y-2 text-sm mt-4 p-4 bg-rose-50/40 dark:bg-rose-950/5 rounded-2xl border border-rose-100/30 dark:border-rose-900/20">
              <label className="font-bold text-slate-700 dark:text-slate-350 text-xs uppercase flex items-center gap-1.5" htmlFor="cancel-reason">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                취소 및 환불 사유 입력
              </label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="예: 고객 요청, 메뉴 품절, 중복 주문 (필수 입력)"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-sm focus-visible:ring-rose-500 font-medium"
              />
            </div>
          )}

          {/* Footer Action buttons */}
          <DialogFooter className="w-full mt-6 border-t border-slate-100 dark:border-slate-850 pt-4">
            <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-3">
              {/* Left group: Danger Actions */}
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  className={`flex-1 sm:flex-initial rounded-xl h-10 px-4 font-bold text-sm transition-all shadow-sm border-none ${
                    isRefundPending
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/10"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                  disabled={hasPickedUp || isRefunded || (isPaidActive && cancelReason.trim().length === 0)}
                  onClick={isRefundPending ? handleRefund : handelOrderCancel}
                >
                  {isRefundPending ? "환불 완료 처리" : isRefunded ? "환불 완료" : isPaidActive ? "취소 및 환불 대기 처리" : "주문 취소"}
                </Button>
                {isUnresolvedPaymentOrder(order) && (
                  <Button
                    className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-10 px-4 font-bold text-sm transition-all shadow-sm border-none"
                    onClick={handlePay}
                  >
                    관리자 결제 완료 처리
                  </Button>
                )}
              </div>

              {/* Right group: Navigation */}
              <Button
                onClick={handleClose}
                variant="outline"
                className="w-full sm:w-auto border-slate-200 dark:border-slate-800 rounded-xl h-10 px-6 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-200"
              >
                닫기
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
