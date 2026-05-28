import { createValidation, getValidation, removeValidation, updateValidation } from "shared/types/requests/admin/table";
import { guardUnsafeRequest, idempotentMutationResponse, ok, parseJsonBody, parseSearchParams, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { createAdminTable, removeAdminTable, updateAdminTable } from "~/lib/server/d1-mutations";
import { getTablesWithRelations } from "~/lib/server/table-queries";

export async function GET(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    parseSearchParams(request, getValidation);

    return ok(await getTablesWithRelations());
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, createValidation);
    return await idempotentMutationResponse(request, "admin:table:create", query, () =>
      createAdminTable(query.tableOptions),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, updateValidation);
    return await idempotentMutationResponse(request, "admin:table:update", query, () =>
      updateAdminTable(query.tableId, query.tableOptions),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, removeValidation);
    return await idempotentMutationResponse(request, "admin:table:delete", query, () =>
      removeAdminTable(query.tableId),
    );
  } catch (error) {
    return routeError(error);
  }
}
