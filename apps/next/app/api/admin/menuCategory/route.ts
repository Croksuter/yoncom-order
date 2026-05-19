import { createValidation, removeValidation, updateValidation } from "shared/types/requests/admin/menuCategory";
import { fail, ok, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import {
  createAdminMenuCategory,
  removeAdminMenuCategory,
  updateAdminMenuCategory,
} from "~/lib/server/d1-mutations";

export async function POST(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const query = createValidation.parse(await request.json());
    const result = await createAdminMenuCategory(query.menuCategoryOptions);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const query = updateValidation.parse(await request.json());
    const result = await updateAdminMenuCategory(query.menuCategoryId, query.menuCategoryOptions);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const query = removeValidation.parse(await request.json());
    const result = await removeAdminMenuCategory(query.menuCategoryId);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return ok(result.result, result.status);
  } catch (error) {
    return routeError(error);
  }
}
