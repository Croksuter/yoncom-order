import { createValidation, removeValidation } from "shared/types/requests/client/order";
import { fail, ok, routeError } from "~/lib/server/api";
import { cancelOrder, createClientOrder } from "~/lib/server/d1-mutations";

export async function POST(request: Request) {
  try {
    const query = createValidation.parse(await request.json());
    const result = await createClientOrder(query.tableId, query.clientOrderId, query.menuOrders);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const query = removeValidation.parse(await request.json());
    const result = await cancelOrder(query.orderId, { allowPaid: false });

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
