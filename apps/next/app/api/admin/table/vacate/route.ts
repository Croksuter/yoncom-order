import { vacateValidation } from "shared/types/requests/admin/table";
import { guardUnsafeRequest, idempotentMutationResponse, parseJsonBody, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { vacateAdminTable } from "~/lib/server/d1-mutations";

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, vacateValidation);
    return await idempotentMutationResponse(request, "admin:table:vacate", query, () =>
      vacateAdminTable(query.tableId),
    );
  } catch (error) {
    return routeError(error);
  }
}
