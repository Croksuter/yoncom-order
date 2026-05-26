import { updateValidation } from "shared/types/requests/admin/client-notice-settings";
import { fail, guardUnsafeRequest, mutationOk, ok, parseJsonBody, parseSearchParams, routeError } from "~/lib/server/api";
import { requireAdmin } from "~/lib/server/auth-session";
import { getClientNoticeSettings, updateClientNoticeSettings } from "~/lib/server/d1-mutations";
import { z } from "zod";

const getValidation = z.object({}).strict();

export async function GET(request: Request) {
  const adminError = await requireAdmin();
  if (adminError) return adminError;

  try {
    parseSearchParams(request, getValidation);
    return ok(await getClientNoticeSettings());
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
    const result = await updateClientNoticeSettings(query.clientNoticeSettings);

    if (result.error) {
      return fail(result.error, result.status);
    }

    return mutationOk(result);
  } catch (error) {
    return routeError(error);
  }
}
