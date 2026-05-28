import { getValidation } from "shared/types/requests/admin/analytics";
import { ok, parseSearchParams, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { getAdminAnalytics } from "~/lib/server/admin-analytics";

export async function GET(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    const query = parseSearchParams(request, getValidation);
    return ok(await getAdminAnalytics(query));
  } catch (error) {
    return routeError(error);
  }
}
