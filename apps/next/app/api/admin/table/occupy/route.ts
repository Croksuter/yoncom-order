import { occupyValidation } from "shared/types/requests/admin/table";
import { fail, ok, routeError } from "~/lib/server/api";
import { occupyAdminTable } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  try {
    const query = occupyValidation.parse(await request.json());
    const result = await occupyAdminTable(query.tableId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
