import { createValidation, getValidation, removeValidation, updateValidation } from "shared/types/requests/admin/table";
import { fail, ok, parseSearchParams, routeError } from "~/lib/server/api";
import { createAdminTable, removeAdminTable, updateAdminTable } from "~/lib/server/d1-mutations";
import { getTablesWithRelations } from "~/lib/server/table-queries";

export async function GET(request: Request) {
  try {
    parseSearchParams(request, getValidation);

    return ok(await getTablesWithRelations());
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const query = createValidation.parse(await request.json());
    const result = await createAdminTable(query.tableOptions.name, query.tableOptions.seats);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const query = updateValidation.parse(await request.json());
    const result = await updateAdminTable(query.tableId, query.tableOptions);

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
    const result = await removeAdminTable(query.tableId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
