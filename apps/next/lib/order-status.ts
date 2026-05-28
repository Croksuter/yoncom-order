import { getMenuOrderDerivedStatus, getMenuOrderProgress } from "~/lib/menu-order-progress";

type PaymentLike = {
  paid?: boolean | null;
  status?: string | null;
};

type MenuOrderLike = {
  quantity?: number | null;
  readyQuantity?: number | null;
  pickedUpQuantity?: number | null;
  status?: string | null;
  deletedAt?: number | string | null;
};

type OrderLike = {
  status?: string | null;
  deletedAt?: number | string | null;
  payment?: PaymentLike | null;
  menuOrders?: MenuOrderLike[] | readonly MenuOrderLike[];
};

const hasDeletedAt = (deletedAt: OrderLike["deletedAt"]) => deletedAt !== null && deletedAt !== undefined;
const hasQuantity = (menuOrder: MenuOrderLike) => typeof menuOrder.quantity === "number";

export const isActiveOrder = (order: OrderLike | null | undefined) => (
  !!order
  && !hasDeletedAt(order.deletedAt)
  && order.status !== "CANCELLED"
  && order.status !== "EXPIRED"
);

export const isPaymentPaid = (payment: PaymentLike | null | undefined) => payment?.status === "PAID";

export const isUnresolvedPaymentOrder = (order: OrderLike | null | undefined) => (
  isActiveOrder(order)
  && !isPaymentPaid(order?.payment)
  && !["CANCELLED", "EXPIRED", "REFUND_PENDING", "REFUNDED"].includes(order?.payment?.status ?? "")
);

export const isPaymentInstructionOrder = (order: OrderLike | null | undefined) => (
  isUnresolvedPaymentOrder(order)
  && (order?.payment?.status === "PENDING" || !order?.payment?.status)
);

export const isKitchenOrder = (order: OrderLike | null | undefined) => (
  isActiveOrder(order)
  && isPaymentPaid(order?.payment)
);

export const getPaymentStatusLabel = (
  payment: PaymentLike | null | undefined,
  order?: OrderLike | null,
) => {
  if (payment?.status === "REFUND_PENDING") return "주문 취소됨 · 환불 대기";
  if (payment?.status === "REFUNDED") return "주문 취소됨 · 환불 완료";
  if (order?.status === "EXPIRED" || payment?.status === "EXPIRED") return "입금 기한 만료";
  if (hasDeletedAt(order?.deletedAt) || order?.status === "CANCELLED" || payment?.status === "CANCELLED") return "주문 취소됨";
  if (payment?.status === "MANUAL_REVIEW") return "입금 확인 필요";
  if (isPaymentPaid(payment)) return "결제 완료";
  if (payment?.paid && !payment?.status) return "결제 완료";
  return "입금 대기";
};

export const getMenuOrderStatusLabel = (
  menuOrder: MenuOrderLike | string | null | undefined,
  order: OrderLike | null | undefined,
) => {
  const status = typeof menuOrder === "string" ? menuOrder : getMenuOrderDerivedStatus(menuOrder);

  if (order?.payment?.status === "REFUND_PENDING") return "환불 대기";
  if (order?.payment?.status === "REFUNDED") return "환불 완료";
  if (order?.status === "EXPIRED" || order?.payment?.status === "EXPIRED") return "입금 기한 만료";
  if (hasDeletedAt(order?.deletedAt) || order?.status === "CANCELLED" || order?.payment?.status === "CANCELLED" || status === "CANCELLED") {
    return "취소";
  }
  if (order?.payment?.status === "MANUAL_REVIEW") return "입금 확인 필요";
  if (!isPaymentPaid(order?.payment)) return "입금 대기";
  if (status === "PENDING") return "조리 중";
  if (status === "READY") return "조리 완료";
  if (status === "PICKED_UP") return "수령 완료";
  return status ?? "-";
};

export const getMenuOrderStatusIcon = (
  menuOrder: MenuOrderLike | string | null | undefined,
  order: OrderLike | null | undefined,
) => {
  const label = getMenuOrderStatusLabel(menuOrder, order);
  if (label === "입금 대기") return "💳";
  if (label === "입금 확인 필요") return "⚠︎";
  if (label === "조리 중" || label === "조리 대기") return "⌛";
  if (label === "조리 완료" || label === "준비 완료") return "🔔";
  if (label === "수령 완료") return "✅";
  return "❌";
};

export const getOrderStatusLabel = (order: OrderLike | null | undefined) => {
  const paymentLabel = getPaymentStatusLabel(order?.payment, order);
  if (!isKitchenOrder(order)) return paymentLabel;

  const activeMenuOrders = (order?.menuOrders ?? []).filter((menuOrder) => !hasDeletedAt(menuOrder.deletedAt));
  if (activeMenuOrders.length > 0 && activeMenuOrders.every((menuOrder) => getMenuOrderDerivedStatus(menuOrder) === "PICKED_UP")) return "수령 완료";
  if (activeMenuOrders.some((menuOrder) => hasQuantity(menuOrder) ? getMenuOrderProgress(menuOrder).pendingQuantity > 0 : menuOrder.status === "PENDING")) return "조리 중";
  if (activeMenuOrders.some((menuOrder) => hasQuantity(menuOrder) ? getMenuOrderProgress(menuOrder).readyQuantity > 0 : menuOrder.status === "READY")) return "조리 완료";
  return paymentLabel;
};
