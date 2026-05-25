import { fail, ok, routeError } from "~/lib/server/api";
import { requireTableSession } from "~/lib/server/table-session";
import { getCustomerOrderResponse } from "~/lib/server/table-queries";

type OrderListRouteContext = {
  params: Promise<{ tableId: string }>;
};

export async function GET(request: Request, { params }: OrderListRouteContext) {
  try {
    const { tableId } = await params;
    const tableSession = await requireTableSession(request, tableId);
    if (tableSession.response) return tableSession.response;

    const result = await getCustomerOrderResponse(tableId);

    if (!result) {
      return fail("Table Not Found", 404);
    }

    return ok(result);
  } catch (error) {
    return routeError(error);
  }
}
