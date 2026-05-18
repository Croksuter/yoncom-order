import { notMigrated } from "~/lib/server/responses";
import { isNull } from "drizzle-orm";
import { menuCategories } from "db/schema";
import { getValidation } from "shared/types/requests/admin/menu";
import { ok, parseSearchParams, routeError } from "~/lib/server/api";
import { getDb } from "~/lib/server/db";

export async function GET(request: Request) {
  try {
    parseSearchParams(request, getValidation);

    const result = await getDb().query.menuCategories.findMany({
      where: isNull(menuCategories.deletedAt),
      with: {
        menus: true,
      },
    });

    return ok(result);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST() {
  return notMigrated("POST /api/admin/menu", {
    requiresAdmin: true,
    schema: "AdminMenuRequest.createValidation",
  });
}

export async function PUT() {
  return notMigrated("PUT /api/admin/menu", {
    requiresAdmin: true,
    schema: "AdminMenuRequest.updateValidation",
  });
}

export async function DELETE() {
  return notMigrated("DELETE /api/admin/menu", {
    requiresAdmin: true,
    schema: "AdminMenuRequest.removeValidation",
  });
}
