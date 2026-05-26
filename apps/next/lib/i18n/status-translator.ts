export const getStatusTranslationKey = (label: string): string => {
  switch (label) {
    case "주문 취소됨 · 환불 대기": return "status_refund_pending";
    case "주문 취소됨 · 환불 완료": return "status_refunded";
    case "입금 기한 만료": return "status_expired";
    case "주문 취소됨": return "status_cancelled";
    case "입금 확인 필요": return "status_manual_review";
    case "결제 완료": return "status_paid";
    case "입금 대기": return "status_pending";
    case "조리 중": return "status_cooking";
    case "조리 완료": return "status_ready";
    case "수령 완료": return "status_picked_up";
    case "환불 대기": return "status_refund_pending_short";
    case "환불 완료": return "status_refunded_short";
    case "취소": return "status_cancelled_short";
    default: return label;
  }
};
