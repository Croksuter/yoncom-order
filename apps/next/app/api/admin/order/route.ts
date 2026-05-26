import { paidValidation, removeValidation } from "shared/types/requests/admin/order";
import { guardUnsafeRequest, idempotentMutationResponse, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdmin, requireAdminUser } from "~/lib/server/auth-session";
import { cancelOrder, markOrderPaid } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, paidValidation);
    return await idempotentMutationResponse(request, "admin:order:paid", query, () => markOrderPaid(query.orderId));
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdminUser();
  if (admin.response) return admin.response;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, removeValidation);
    return await idempotentMutationResponse(request, "admin:order:delete", query, () =>
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
