import { ignoreValidation } from "shared/types/requests/admin/deposit";
import { guardUnsafeRequest, idempotentMutationResponse, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { ignoreBankTransaction } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, ignoreValidation);
    return await idempotentMutationResponse(request, "admin:deposit:ignore", query, () =>
      ignoreBankTransaction(query.bankTransactionId),
    );
  } catch (error) {
    return routeError(error);
  }
}
