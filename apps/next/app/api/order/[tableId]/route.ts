import { fail, ok, routeError } from "~/lib/server/api";
import { getCustomerOrderResponse } from "~/lib/server/table-queries";

type OrderListRouteContext = {
  params: Promise<{ tableId: string }>;
};

export async function GET(_request: Request, { params }: OrderListRouteContext) {
  try {
    const { tableId } = await params;
    const result = await getCustomerOrderResponse(tableId);

    if (!result) {
      return fail("Table Not Found", 404);
    }

    return ok(result);
  } catch (error) {
    return routeError(error);
  }
}
