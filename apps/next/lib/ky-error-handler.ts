import { HTTPError } from "ky";
import * as ClientErrorResponse from "shared/types/responses/client/error";
import { toast } from "~/hooks/use-toast";

function getUserFacingErrorMessage(error?: string) {
  const messages: Record<string, string> = {
    "Invalid request": "요청 정보가 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해주세요.",
    "Table Not Found": "테이블 정보를 찾을 수 없습니다.",
    "Menu Not Found": "주문할 수 없는 메뉴가 포함되어 있습니다.",
    "Menu Not Enough": "남은 수량이 부족합니다. 메뉴 수량을 다시 확인해주세요.",
    "Unpaid Order Exists": "입금 확인 전 주문이 있어 추가 주문할 수 없습니다.",
    "Payment Code Exhausted": "사용 가능한 결제코드가 모두 사용 중입니다. 잠시 후 다시 시도해주세요.",
    "Paid Order Cannot Be Deleted": "결제 완료 주문은 고객 화면에서 취소할 수 없습니다. 운영자에게 문의해주세요.",
    "Cancel Reason Required": "결제 완료 주문 취소에는 환불 확인을 위한 사유가 필요합니다.",
    "Picked Up Order Cannot Be Cancelled": "수령 완료된 주문은 시스템에서 취소할 수 없습니다.",
    "Refund Already Pending": "이미 환불 대기 상태인 주문입니다.",
    "Order Already Refunded": "이미 환불 완료된 주문입니다.",
    "Refund is not pending": "환불 대기 상태의 주문만 환불 완료 처리할 수 있습니다.",
    "Order is not paid yet": "결제 완료 전에는 준비 완료 처리할 수 없습니다.",
    "Menu order must be pending before ready": "이미 처리된 메뉴는 준비 완료로 바꿀 수 없습니다.",
    "Menu order must be ready before pickup": "준비 완료 상태의 메뉴만 수령 완료 처리할 수 있습니다.",
    "Bank Transaction Not Found": "입금 내역을 찾을 수 없습니다.",
    "Payment Not Found": "결제 정보를 찾을 수 없습니다.",
    "Payment Cannot Be Marked Paid": "취소, 만료, 환불 상태의 결제는 결제 완료로 되돌릴 수 없습니다.",
    "There are unfinished orders": "아직 조리 중이거나 수령 대기 중인 메뉴가 있어 테이블을 비울 수 없습니다.",
    "Refund Pending Orders Exist": "환불 대기 중인 주문이 있어 테이블을 비울 수 없습니다.",
    Unauthorized: "로그인이 필요합니다.",
    Forbidden: "관리자 권한이 필요합니다.",
    "DB Query Error": "데이터 처리 중 오류가 발생했습니다. 운영자에게 문의해주세요.",
  };

  if (!error) {
    return "요청 처리 중 오류가 발생했습니다.";
  }

  return messages[error] ?? error;
}

export default async function kyErrorHandler(error: unknown) {
  if (error instanceof HTTPError) {
    const res = await error.response.json<ClientErrorResponse.Error>().catch(() => null);

    if (res?.error === "NEXT_MIGRATION_NOT_IMPLEMENTED") {
      console.info(new Date().toLocaleString(), "Migration placeholder:", res.error);
      return;
    }

    console.error(new Date().toLocaleString(), "HTTP Error:", res?.error ?? error.response.status);
    toast({
      variant: "destructive",
      title: "오류가 발생했습니다.",
      description: getUserFacingErrorMessage(res?.error),
      duration: 3000,
    });
  } else {
    console.error(new Date().toLocaleString(), "Fetch Error:", error);
    toast({
      variant: "destructive",
      title: "오류가 발생했습니다.",
      description: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
      duration: 3000,
    });
  }
}
