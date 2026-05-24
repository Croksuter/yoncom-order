import { createValidation, removeValidation } from "shared/types/requests/client/order";
import { fail, guardUnsafeRequest, mutationOk, parseJsonBody, routeError } from "~/lib/server/api";
import { cancelOrder, createClientOrder } from "~/lib/server/d1-mutations";
import { requireTableSession, requireTableSessionForOrder } from "~/lib/server/table-session";

export async function POST(request: Request) {
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, createValidation);
    const tableSession = await requireTableSession(request, query.tableId);
    if (tableSession.response) return tableSession.response;
    const result = await createClientOrder(query.tableId, query.clientOrderId, query.menuOrders);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, removeValidation);
    const tableSession = await requireTableSessionForOrder(request, query.orderId);
    if (tableSession.response) return tableSession.response;

    const result = await cancelOrder(query.orderId, { allowPaid: false });

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}
