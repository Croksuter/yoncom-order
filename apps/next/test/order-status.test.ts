import { describe, expect, it } from "vitest";
import {
  getMenuOrderStatusIcon,
  getMenuOrderStatusLabel,
  getOrderStatusLabel,
  isKitchenOrder,
  isPaymentInstructionOrder,
  isUnresolvedPaymentOrder,
} from "~/lib/order-status";

const baseOrder = {
  status: "ACTIVE",
  deletedAt: null,
  payment: {
    paid: false,
    status: "PENDING",
  },
  menuOrders: [
    { status: "PENDING", deletedAt: null },
  ],
};

describe("order status display helpers", () => {
  it("does not describe unpaid pending menu orders as cooking work", () => {
    expect(getOrderStatusLabel(baseOrder)).toBe("입금 대기");
    expect(getMenuOrderStatusLabel(baseOrder.menuOrders[0], baseOrder)).toBe("입금 대기");
    expect(getMenuOrderStatusIcon(baseOrder.menuOrders[0], baseOrder)).toBe("💳");
    expect(isKitchenOrder(baseOrder)).toBe(false);
  });

  it("only exposes paid active orders to kitchen views", () => {
    const paidOrder = {
      ...baseOrder,
      payment: { paid: true, status: "PAID" },
    };

    expect(isKitchenOrder(paidOrder)).toBe(true);
    expect(getOrderStatusLabel(paidOrder)).toBe("조리 대기");
    expect(getMenuOrderStatusLabel(paidOrder.menuOrders[0], paidOrder)).toBe("조리 대기");
  });

  it("keeps manual review orders blocking but not payment-instruction eligible", () => {
    const reviewOrder = {
      ...baseOrder,
      payment: { paid: false, status: "MANUAL_REVIEW" },
    };

    expect(isUnresolvedPaymentOrder(reviewOrder)).toBe(true);
    expect(isPaymentInstructionOrder(reviewOrder)).toBe(false);
    expect(getOrderStatusLabel(reviewOrder)).toBe("입금 확인 필요");
    expect(getMenuOrderStatusLabel(reviewOrder.menuOrders[0], reviewOrder)).toBe("입금 확인 필요");
  });

  it("does not treat refund-pending legacy paid rows as kitchen-active", () => {
    const refundPendingOrder = {
      ...baseOrder,
      payment: { paid: true, status: "REFUND_PENDING" },
    };

    expect(isKitchenOrder(refundPendingOrder)).toBe(false);
    expect(isUnresolvedPaymentOrder(refundPendingOrder)).toBe(false);
    expect(getOrderStatusLabel(refundPendingOrder)).toBe("주문 취소됨 · 환불 대기");
    expect(getMenuOrderStatusLabel(refundPendingOrder.menuOrders[0], refundPendingOrder)).toBe("환불 대기");
  });
});
