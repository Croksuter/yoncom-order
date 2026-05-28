import { deleteRecordsValidation, getValidation, saveAnalyticsSettingsValidation } from "shared/types/requests/admin/analytics";
import { guardUnsafeRequest, idempotentMutationResponse, ok, parseJsonBody, parseSearchParams, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { deleteAdminAnalyticsRecords, getAdminAnalytics, saveAdminAnalyticsSettings } from "~/lib/server/admin-analytics";

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

export async function DELETE(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;
  const guardError = guardUnsafeRequest(request, { csrf: true, idempotency: true });
  if (guardError) return guardError;

  try {
    const query = await parseJsonBody(request, deleteRecordsValidation);
    return await idempotentMutationResponse(request, "admin:analytics:records:delete", query, () =>
      deleteAdminAnalyticsRecords(query),
    );
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
    const query = await parseJsonBody(request, saveAnalyticsSettingsValidation);
    return await idempotentMutationResponse(request, "admin:analytics:settings:save", query, () =>
      saveAdminAnalyticsSettings(query),
    );
  } catch (error) {
    return routeError(error);
  }
}
