import { menuOrderStatus } from "db/schema";
import { pickUpValidation } from "shared/types/requests/admin/order";
import { guardUnsafeRequest, idempotentMutationResponse, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { setMenuOrderStatus } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, pickUpValidation);
    return await idempotentMutationResponse(request, "admin:order:pick-up", query, () =>
      setMenuOrderStatus(query.menuOrderId, menuOrderStatus.PICKED_UP),
    );
  } catch (error) {
    return routeError(error);
  }
}
