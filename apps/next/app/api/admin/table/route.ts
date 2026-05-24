import { createValidation, getValidation, removeValidation, updateValidation } from "shared/types/requests/admin/table";
import { fail, guardUnsafeRequest, mutationOk, ok, parseJsonBody, parseSearchParams, routeError } from "~/lib/server/api";
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
    const result = await createAdminTable(query.tableOptions.name, query.tableOptions.seats);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
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
    const result = await updateAdminTable(query.tableId, query.tableOptions);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
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
    const result = await removeAdminTable(query.tableId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}
