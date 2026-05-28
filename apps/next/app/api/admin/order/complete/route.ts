import { completeValidation } from "shared/types/requests/admin/order";
import { guardUnsafeRequest, idempotentMutationResponse, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { completeMenuOrder } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, completeValidation);
    return await idempotentMutationResponse(request, "admin:order:complete", query, () =>
      completeMenuOrder(query.menuOrderId, query.quantity),
    );
  } catch (error) {
    return routeError(error);
  }
}
