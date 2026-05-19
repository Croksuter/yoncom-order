import { getValidation } from "shared/types/requests/client/table";
import { fail, ok, parseSearchParams, routeError } from "~/lib/server/api";
import { getTablesWithRelations } from "~/lib/server/table-queries";

export async function GET(request: Request) {
  try {
    const query = parseSearchParams(request, getValidation);

    const table = (await getTablesWithRelations(query.tableId))[0];

    if (!table) {
      return fail("Table Not Found", 409);
    }

    return ok(table);
  } catch (error) {
    return routeError(error);
  }
}
