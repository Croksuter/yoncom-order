import { menuOrderStatus } from "db/schema";
import { pickUpValidation } from "shared/types/requests/admin/order";
import { fail, ok, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { setMenuOrderStatus } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const query = pickUpValidation.parse(await request.json());
    const result = await setMenuOrderStatus(query.menuOrderId, menuOrderStatus.PICKED_UP);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
