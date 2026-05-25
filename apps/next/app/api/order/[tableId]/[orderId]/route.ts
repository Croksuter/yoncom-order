import { fail, ok, routeError } from "~/lib/server/api";
import { requireTableSession } from "~/lib/server/table-session";
import { getCustomerOrderResponse } from "~/lib/server/table-queries";

type OrderDetailRouteContext = {
  params: Promise<{ tableId: string; orderId: string }>;
};

export async function GET(request: Request, { params }: OrderDetailRouteContext) {
  try {
    const { tableId, orderId } = await params;
    const tableSession = await requireTableSession(request, tableId);
    if (tableSession.response) return tableSession.response;

    const result = await getCustomerOrderResponse(tableId, orderId);

    if (!result) {
      return fail("Table Not Found", 404);
    }

    if (result.tableContextId === null || result.orders.length === 0) {
      return fail("Order Not Found", 404);
    }

    return ok(result);
  } catch (error) {
    return routeError(error);
  }
}
