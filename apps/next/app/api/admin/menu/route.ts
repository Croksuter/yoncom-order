import { isNull } from "drizzle-orm";
import { menuCategories } from "db/schema";
import { createValidation, getValidation, removeValidation, updateValidation } from "shared/types/requests/admin/menu";
import { fail, guardUnsafeRequest, mutationOk, ok, parseJsonBody, parseSearchParams, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { getDb } from "~/lib/server/db";
import { createAdminMenu, enrichMenuCategoriesWithBundles, removeAdminMenu, updateAdminMenu } from "~/lib/server/d1-mutations";

export async function GET(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

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

export async function POST(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, createValidation);
    const result = await createAdminMenu(query.menuOptions);

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
    const result = await updateAdminMenu(query.menuId, query.menuOptions);

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
    const result = await removeAdminMenu(query.menuId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}
