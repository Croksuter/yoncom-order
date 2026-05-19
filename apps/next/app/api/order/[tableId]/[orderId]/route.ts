import { fail, ok, routeError } from "~/lib/server/api";
import { getCustomerOrderResponse } from "~/lib/server/table-queries";

type OrderDetailRouteContext = {
  params: Promise<{ tableId: string; orderId: string }>;
};

export async function GET(_request: Request, { params }: OrderDetailRouteContext) {
  try {
    const { tableId, orderId } = await params;
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
