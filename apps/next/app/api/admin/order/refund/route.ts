import { refundValidation } from "shared/types/requests/admin/order";
import { guardUnsafeRequest, idempotentMutationResponse, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdminUser } from "~/lib/server/auth-session";
import { completeOrderRefund } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const admin = await requireAdminUser();
  if (admin.response) return admin.response;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, refundValidation);
    return await idempotentMutationResponse(request, "admin:order:refund", query, () =>
      completeOrderRefund(query.orderId, {
        adminUserId: admin.user?.id ?? null,
        refundNote: query.refundNote,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
