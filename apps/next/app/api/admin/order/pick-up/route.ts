import { menuOrderStatus } from "db/schema";
import { pickUpValidation } from "shared/types/requests/admin/order";
import { fail, guardUnsafeRequest, mutationOk, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { setMenuOrderStatus } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, pickUpValidation);
    const result = await setMenuOrderStatus(query.menuOrderId, menuOrderStatus.PICKED_UP);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}
