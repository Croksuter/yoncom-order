import { menuOrderStatus } from "db/schema";
import { completeValidation } from "shared/types/requests/admin/order";
import { fail, ok, routeError } from "~/lib/server/api";
import { setMenuOrderStatus } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  try {
    const query = completeValidation.parse(await request.json());
    const result = await setMenuOrderStatus(query.menuOrderId, menuOrderStatus.SERVED);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
