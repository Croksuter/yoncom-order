import { removeValidation } from "shared/types/requests/admin/order";
import { guardUnsafeRequest, idempotentMutationResponse, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdminUser } from "~/lib/server/auth-session";
import { cancelOrder } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const admin = await requireAdminUser();
  if (admin.response) return admin.response;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, removeValidation);
    return await idempotentMutationResponse(request, "admin:order:cancel", query, () =>
      cancelOrder(query.orderId, {
        allowPaid: true,
        adminUserId: admin.user?.id ?? null,
        cancelReason: query.cancelReason,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
