import { createValidation, removeValidation } from "shared/types/requests/client/order";
import { csrfCookieName } from "~/lib/server/auth-session";
import { fail, getRequestCookie, guardUnsafeRequest, mutationOk, parseJsonBody, routeError } from "~/lib/server/api";
import { cancelOrder, createClientOrder, createClientOrderForNewTableSession } from "~/lib/server/d1-mutations";
import {
  attachTableSessionCookies,
  createTableSession,
  getValidTableSession,
  requireTableSessionForOrder,
} from "~/lib/server/table-session";

function requireCsrfToken(request: Request) {
  const csrfCookie = getRequestCookie(request, csrfCookieName);
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return fail("CSRF token required", 403);
  }

  return null;
}

export async function POST(request: Request) {
  const guardError = guardUnsafeRequest(request, { csrf: false, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, createValidation);
    const tableSession = await getValidTableSession(request, query.tableId);
    if (tableSession) {
      const csrfError = requireCsrfToken(request);
      if (csrfError) return csrfError;
    }

    const result = tableSession
      ? await createClientOrder(query.tableId, tableSession.tableContextId, query.clientOrderId, query.menuOrders)
      : query.startNewTableSession
        ? await createClientOrderForNewTableSession(query.tableId, query.clientOrderId, query.menuOrders)
        : { error: "Table session required", status: 401 };

    if (result.error) {
      return fail(result.error, result.status);
    }

    const response = mutationOk(result);
    if (!tableSession && query.startNewTableSession && result.tableContextId) {
      const issuedSession = await createTableSession(query.tableId, result.tableContextId);
      attachTableSessionCookies(response, issuedSession);
    }

    return response;
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
