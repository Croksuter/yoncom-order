import { notMigrated } from "~/lib/server/responses";
import { getValidation } from "shared/types/requests/admin/table";
import { ok, parseSearchParams, routeError } from "~/lib/server/api";
import { getTablesWithRelations } from "~/lib/server/table-queries";

export async function GET(request: Request) {
  try {
    parseSearchParams(request, getValidation);

    return ok(await getTablesWithRelations());
  } catch (error) {
    return routeError(error);
  }
}

export async function POST() {
  return notMigrated("POST /api/admin/table", {
    requiresAdmin: true,
    schema: "AdminTableRequest.createValidation",
  });
}

export async function PUT() {
  return notMigrated("PUT /api/admin/table", {
    requiresAdmin: true,
    schema: "AdminTableRequest.updateValidation",
  });
}

export async function DELETE() {
  return notMigrated("DELETE /api/admin/table", {
    requiresAdmin: true,
    schema: "AdminTableRequest.removeValidation",
  });
}
