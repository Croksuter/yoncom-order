import { isNull } from "drizzle-orm";
import { menuCategories } from "db/schema";
import { getValidation } from "shared/types/requests/client/menu";
import { ok, parseSearchParams, routeError } from "~/lib/server/api";
import { getDb } from "~/lib/server/db";
import { enrichMenuCategoriesWithBundles } from "~/lib/server/d1-mutations";

export async function GET(request: Request) {
  try {
    parseSearchParams(request, getValidation);

    const result = await getDb().query.menuCategories.findMany({
      where: isNull(menuCategories.deletedAt),
      with: {
        menus: true,
      },
    });

    return ok(await enrichMenuCategoriesWithBundles(result));
  } catch (error) {
    return routeError(error);
  }
}
