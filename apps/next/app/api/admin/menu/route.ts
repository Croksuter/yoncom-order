import { isNull } from "drizzle-orm";
import { menuCategories } from "db/schema";
import { createValidation, getValidation, removeValidation, updateValidation } from "shared/types/requests/admin/menu";
import { fail, ok, parseSearchParams, routeError } from "~/lib/server/api";
import { getDb } from "~/lib/server/db";
import { createAdminMenu, removeAdminMenu, updateAdminMenu } from "~/lib/server/d1-mutations";

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

export async function POST(request: Request) {
  try {
    const query = createValidation.parse(await request.json());
    const result = await createAdminMenu(query.menuOptions);

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
    const result = await updateAdminMenu(query.menuId, query.menuOptions);

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
    const result = await removeAdminMenu(query.menuId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
