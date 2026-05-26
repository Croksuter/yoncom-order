import { getValidation } from "shared/types/requests/client/table";
import { fail, ok, parseSearchParams, routeError } from "~/lib/server/api";
import { getPaymentSettings } from "~/lib/server/d1-mutations";
import { requireTableSession } from "~/lib/server/table-session";
import { getAuthorizedClientTable } from "~/lib/server/table-queries";

export async function GET(request: Request) {
  try {
    const query = parseSearchParams(request, getValidation);
    const tableSession = await requireTableSession(request, query.tableId);
    if (tableSession.response) return tableSession.response;

    const table = await getAuthorizedClientTable(query.tableId, tableSession.session.tableContextId);

    if (!table) {
      return fail("Table Not Found", 409);
    }

    return ok({
      ...table,
      paymentSettings: await getPaymentSettings(),
    });
  } catch (error) {
    return routeError(error);
  }
}
