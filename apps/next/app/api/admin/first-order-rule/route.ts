import { getValidation, updateValidation } from "shared/types/requests/admin/first-order-rule";
import { fail, guardUnsafeRequest, mutationOk, ok, parseJsonBody, parseSearchParams, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { getFirstOrderRule, updateFirstOrderRule } from "~/lib/server/d1-mutations";

export async function GET(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    parseSearchParams(request, getValidation);
    return ok(await getFirstOrderRule());
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
    const result = await updateFirstOrderRule(query.rule);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}
