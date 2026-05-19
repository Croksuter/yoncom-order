import { vacateValidation } from "shared/types/requests/admin/table";
import { fail, ok, routeError } from "~/lib/server/api";
import { vacateAdminTable } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  try {
    const query = vacateValidation.parse(await request.json());
    const result = await vacateAdminTable(query.tableId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
